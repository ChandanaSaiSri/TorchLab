import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { AiUnavailable, aiConfigured, askClaude, buildSystem, buildUser, dailyLimit, leaksSolution } from '../services/ai.js';

const router = Router();
router.use(requireAuth);

const hourly = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 25, keyGenerator: (req) => `u${req.user.id}`,
  message: { error: 'You have used a lot of AI help this hour. Try again later.' },
});

/** Help is switched off while the learner has an assessment running, so it cannot be used to answer it. */
async function assessmentRunning(userId) {
  const { rows } = await query(
    "SELECT 1 FROM assessment_attempts WHERE user_id=$1 AND status IN ('in_progress','grading') AND deadline > now() - interval '1 minute' LIMIT 1", [userId]);
  return rows.length > 0;
}

async function usedToday(userId) {
  const { rows } = await query('SELECT count FROM ai_usage WHERE user_id=$1 AND day=CURRENT_DATE', [userId]);
  return rows[0]?.count ?? 0;
}

router.get('/status', async (req, res) => {
  const used = await usedToday(req.user.id);
  res.json({ configured: aiConfigured(), dailyLimit: dailyLimit(), usedToday: used, paused: aiConfigured() ? await assessmentRunning(req.user.id) : false });
});

const bodySchema = z.object({
  mode: z.enum(['explain', 'debug', 'hint', 'review']),
  code: z.string().trim().min(1, 'There is no code to look at yet').max(12000, 'The code is too long for the assistant (max 12,000 characters)'),
  output: z.string().max(6000).optional(),
  question: z.string().trim().max(400).optional(),
  context: z.object({
    kind: z.enum(['playground', 'lesson', 'challenge', 'project']),
    slug: z.string().max(100).optional(),
    course: z.string().max(100).optional(),
    milestone: z.number().int().min(1).max(50).optional(),
  }).optional(),
});

/** What the assistant may know about the page the learner is on: the task text, and (server side only) the reference solution. */
async function loadContext(ctx) {
  if (!ctx?.slug) return { text: '', solution: '' };
  if (ctx.kind === 'challenge') {
    const r = (await query('SELECT title,description_md,solution_code FROM challenges WHERE slug=$1 AND published', [ctx.slug])).rows[0];
    return r ? { text: `Exercise: ${r.title}\n${r.description_md}`, solution: r.solution_code } : { text: '', solution: '' };
  }
  if (ctx.kind === 'lesson') {
    const r = (await query('SELECT l.title,l.content_md FROM lessons l JOIN courses c ON c.id=l.course_id WHERE l.slug=$1 AND ($2::text IS NULL OR c.slug=$2)', [ctx.slug, ctx.course ?? null])).rows[0];
    return r ? { text: `Lesson: ${r.title}\n${r.content_md}`, solution: '' } : { text: '', solution: '' };
  }
  if (ctx.kind === 'project') {
    const r = (await query(
      `SELECT p.title AS project, m.title, m.description_md, m.solution_code FROM projects p JOIN project_milestones m ON m.project_id=p.id
       WHERE p.slug=$1 AND m.position=$2`, [ctx.slug, ctx.milestone ?? 1])).rows[0];
    return r ? { text: `Project: ${r.project}. Milestone: ${r.title}\n${r.description_md}`, solution: r.solution_code } : { text: '', solution: '' };
  }
  return { text: '', solution: '' };
}

router.post('/assist', hourly, async (req, res) => {
  if (!aiConfigured()) return res.status(503).json({ configured: false, error: 'The AI assistant is not switched on for this server yet.' });
  const p = bodySchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  if (await assessmentRunning(req.user.id)) return res.status(403).json({ error: 'AI help is paused while an assessment is running.' });

  // Reserve one of today's requests atomically; give it back if the call fails.
  const slot = await query(
    `INSERT INTO ai_usage(user_id,day,count) VALUES ($1,CURRENT_DATE,1)
     ON CONFLICT (user_id,day) DO UPDATE SET count = ai_usage.count + 1 WHERE ai_usage.count < $2 RETURNING count`,
    [req.user.id, dailyLimit()]
  );
  if (!slot.rows[0]) return res.status(429).json({ error: `You have used today's ${dailyLimit()} AI requests. They reset at midnight.` });

  try {
    const { mode, code, output, question, context } = p.data;
    const ctx = await loadContext(context);
    let answer = await askClaude({ system: buildSystem(mode), user: buildUser({ code, output, question, context: ctx.text }) });
    let withheld = false;
    if (leaksSolution(answer, ctx.solution)) {
      withheld = true;
      answer = 'I held back that answer because it would give away the whole solution. Ask me for a smaller hint, or tell me which step you are stuck on, and I will guide you toward it.';
    }
    res.json({ answer, withheld, usedToday: slot.rows[0].count, dailyLimit: dailyLimit() });
  } catch (e) {
    await query('UPDATE ai_usage SET count = GREATEST(count - 1, 0) WHERE user_id=$1 AND day=CURRENT_DATE', [req.user.id]);
    if (e instanceof AiUnavailable) return res.status(502).json({ error: e.message });
    throw e;
  }
});

export default router;
