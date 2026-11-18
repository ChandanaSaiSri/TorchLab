import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { awardXp, recordActivity } from '../services/activity.js';
import { composeProgram, newNonce, parseResults, summarize } from '../services/challengeFormat.js';
import { runProgram, RunnerError } from '../services/runner.js';
import { issueCertificate } from '../services/certificates.js';
import { syncAchievements } from '../services/achievements.js';
import { PROJECT_XP, joinCode } from '../services/projectFormat.js';

const router = Router();
router.use(requireAuth);

const SOLUTION_UNLOCK_ATTEMPTS = 3;
const codeSchema = z.object({ code: z.string().min(1).max(40000) });

const limiter = (limit, message) =>
  rateLimit({ windowMs: 60 * 1000, limit, keyGenerator: (req) => `u${req.user.id}`, message: { error: message } });
const submitLimiter = limiter(10, 'Slow down: max 10 submissions per minute');
const runLimiter = limiter(20, 'Slow down: max 20 runs per minute');

async function loadProject(slug) {
  const { rows } = await query('SELECT * FROM projects WHERE slug=$1 AND published', [slug]);
  return rows[0] || null;
}
const loadMilestones = async (projectId) =>
  (await query('SELECT * FROM project_milestones WHERE project_id=$1 ORDER BY position', [projectId])).rows;
async function loadProgress(userId, projectId) {
  const { rows } = await query('SELECT * FROM project_progress WHERE user_id=$1 AND project_id=$2', [userId, projectId]);
  return rows[0] || null;
}

function progressView(pr, total) {
  if (!pr) return { started: false, unlocked: 0, passed: 0, total, completed: false };
  return { started: true, unlocked: pr.unlocked, passed: pr.passed, total, completed: !!pr.completed_at, completedAt: pr.completed_at };
}

router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT p.id,p.slug,p.title,p.level,p.hours,p.summary,p.skills,
            (SELECT COUNT(*) FROM project_milestones m WHERE m.project_id=p.id)::int AS total,
            pr.passed, pr.unlocked, pr.completed_at, c.code AS certificate
     FROM projects p
     LEFT JOIN project_progress pr ON pr.project_id=p.id AND pr.user_id=$1
     LEFT JOIN certificates c ON c.user_id=$1 AND c.kind='project' AND c.ref=p.slug
     WHERE p.published ORDER BY p.position, p.id`,
    [req.user.id]
  );
  const projects = rows.map((r) => ({
    slug: r.slug, title: r.title, level: r.level, hours: r.hours, summary: r.summary, skills: r.skills, total: r.total,
    passed: r.passed ?? 0, xp: PROJECT_XP, certificate: r.certificate || null,
    status: r.completed_at ? 'completed' : r.unlocked ? 'active' : 'new',
  }));
  res.json({
    projects,
    summary: { total: projects.length, completed: projects.filter((p) => p.status === 'completed').length, active: projects.filter((p) => p.status === 'active').length },
  });
});

router.get('/:slug', async (req, res) => {
  const p = await loadProject(req.params.slug);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  const ms = await loadMilestones(p.id);
  const pr = await loadProgress(req.user.id, p.id);
  const unlocked = pr?.unlocked ?? 0;
  const hintsUsed = pr?.hints_used ?? {};
  const attempts = pr?.attempts ?? {};
  const cert = pr?.completed_at
    ? (await query(`SELECT code FROM certificates WHERE user_id=$1 AND kind='project' AND ref=$2`, [req.user.id, p.slug])).rows[0]
    : null;
  res.json({
    project: { slug: p.slug, title: p.title, level: p.level, hours: p.hours, summary: p.summary, skills: p.skills, overview_md: p.overview_md, xp: PROJECT_XP },
    milestones: ms.map((m) => {
      const open = m.position <= unlocked;
      const used = hintsUsed[m.position] || 0;
      const tries = attempts[m.position] || 0;
      return {
        position: m.position, title: m.title,
        status: m.position <= (pr?.passed ?? 0) ? 'passed' : open ? 'open' : 'locked',
        description_md: open ? m.description_md : null,
        hintsTotal: m.hints.length,
        hints: open ? m.hints.slice(0, used) : [],
        attempts: tries,
        solutionUnlocked: open && (tries >= SOLUTION_UNLOCK_ATTEMPTS || m.position <= (pr?.passed ?? 0)),
      };
    }),
    progress: progressView(pr, ms.length),
    // before starting, show the first milestone's starter so the learner can read it
    code: pr ? pr.code : ms[0].starter_code,
    certificate: cert?.code || null,
  });
});

router.post('/:slug/start', async (req, res) => {
  const p = await loadProject(req.params.slug);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  const ms = await loadMilestones(p.id);
  await query(
    `INSERT INTO project_progress(user_id,project_id,code,unlocked) VALUES ($1,$2,$3,1) ON CONFLICT DO NOTHING`,
    [req.user.id, p.id, joinCode([ms[0].starter_code])]
  );
  await recordActivity(req.user.id);
  res.json({ ok: true });
});

router.put('/:slug/code', async (req, res) => {
  const parsed = codeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Code is required (max 40,000 characters)' });
  const p = await loadProject(req.params.slug);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  const r = await query('UPDATE project_progress SET code=$3, updated_at=now() WHERE user_id=$1 AND project_id=$2', [req.user.id, p.id, parsed.data.code]);
  if (!r.rowCount) return res.status(400).json({ error: 'Start the project first' });
  res.json({ ok: true });
});

/** Free run of the learner's program (with the project's data helpers available), no grading. */
router.post('/:slug/run', runLimiter, async (req, res) => {
  const parsed = codeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Code is required (max 40,000 characters)' });
  const p = await loadProject(req.params.slug);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  try {
    const out = await runProgram(parsed.data.code, p.files);
    await recordActivity(req.user.id);
    res.json(out);
  } catch (e) {
    if (e instanceof RunnerError) return res.status(503).json({ error: e.message });
    throw e;
  }
});

async function loadMilestone(slug, n) {
  const p = await loadProject(slug);
  if (!p) return {};
  const { rows } = await query('SELECT * FROM project_milestones WHERE project_id=$1 AND position=$2', [p.id, n]);
  return { p, m: rows[0] || null };
}

router.post('/:slug/milestones/:n/hint', async (req, res) => {
  const n = Number(req.params.n);
  const { p, m } = await loadMilestone(req.params.slug, n);
  if (!p || !m) return res.status(404).json({ error: 'Milestone not found' });
  const pr = await loadProgress(req.user.id, p.id);
  if (!pr || n > pr.unlocked) return res.status(403).json({ error: 'This milestone is locked' });
  const used = (pr.hints_used[n] || 0) + 1;
  if (used > m.hints.length) return res.status(400).json({ error: 'No more hints for this milestone' });
  await query(`UPDATE project_progress SET hints_used = hints_used || jsonb_build_object($3::text, $4::int) WHERE user_id=$1 AND project_id=$2`, [req.user.id, p.id, String(n), used]);
  res.json({ hint: m.hints[used - 1], hintsUsed: used, hintsTotal: m.hints.length });
});

router.post('/:slug/milestones/:n/solution', async (req, res) => {
  const n = Number(req.params.n);
  const { p, m } = await loadMilestone(req.params.slug, n);
  if (!p || !m) return res.status(404).json({ error: 'Milestone not found' });
  const pr = await loadProgress(req.user.id, p.id);
  if (!pr || n > pr.unlocked) return res.status(403).json({ error: 'This milestone is locked' });
  const tries = pr.attempts[n] || 0;
  if (n > pr.passed && tries < SOLUTION_UNLOCK_ATTEMPTS) {
    return res.status(403).json({ error: `The solution unlocks after ${SOLUTION_UNLOCK_ATTEMPTS} attempts (you have made ${tries}).` });
  }
  res.json({ solution: m.solution_code });
});

router.post('/:slug/milestones/:n/submit', submitLimiter, async (req, res) => {
  const parsed = codeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Code is required (max 40,000 characters)' });
  const n = Number(req.params.n);
  const { p, m } = await loadMilestone(req.params.slug, n);
  if (!p || !m) return res.status(404).json({ error: 'Milestone not found' });
  const pr = await loadProgress(req.user.id, p.id);
  if (!pr) return res.status(400).json({ error: 'Start the project first' });
  if (n > pr.unlocked) return res.status(403).json({ error: 'Finish the previous milestone first' });
  const { code } = parsed.data;

  const nonce = newNonce();
  let out;
  try {
    out = await runProgram(composeProgram(code, m.tests, nonce), p.files);
  } catch (e) {
    if (e instanceof RunnerError) return res.status(503).json({ error: e.message });
    throw e;
  }
  const { tests, userStdout } = parseResults(out.stdout || '', nonce);
  const summary = tests ? summarize(tests) : null;
  const passed = !!summary?.passed;

  const total = Number((await query('SELECT COUNT(*)::int AS n FROM project_milestones WHERE project_id=$1', [p.id])).rows[0].n);
  const attemptsNow = (pr.attempts[n] || 0) + 1;
  let newCode = code;
  let unlocked = pr.unlocked;
  let passedUpTo = pr.passed;
  let completedNow = false;
  if (passed) {
    passedUpTo = Math.max(pr.passed, n);
    if (n === pr.unlocked && n < total) {
      const next = (await query('SELECT starter_code FROM project_milestones WHERE project_id=$1 AND position=$2', [p.id, n + 1])).rows[0];
      newCode = joinCode([code, next.starter_code]);
      unlocked = n + 1;
    }
    completedNow = passedUpTo >= total && !pr.completed_at;
  }
  await query(
    `UPDATE project_progress SET code=$3, unlocked=$4, passed=$5, updated_at=now(),
       attempts = attempts || jsonb_build_object($6::text, $7::int),
       completed_at = CASE WHEN $8 THEN now() ELSE completed_at END
     WHERE user_id=$1 AND project_id=$2`,
    [req.user.id, p.id, newCode, unlocked, passedUpTo, String(n), attemptsNow, completedNow]
  );
  await recordActivity(req.user.id);

  let xpAwarded = 0;
  let certificate = null;
  if (completedNow) {
    if (await awardXp(req.user.id, PROJECT_XP, 'project', p.id)) xpAwarded = PROJECT_XP;
    certificate = (await issueCertificate(req.user.id, 'project', p.slug, `${p.title} - Live Project`)).code;
    await syncAchievements(req.user.id);   // project badges depend on the completion that was just stored
  }
  res.json({
    passed,
    status: out.status,
    runtime_ms: out.runtime_ms,
    stdout: userStdout.slice(0, 8000),
    runError: tests ? null : (out.stderr || '').slice(-3000) || 'Your program stopped before the tests could run.',
    visible: summary?.visible ?? [],
    hidden: summary?.hidden ?? { total: 0, passed: 0 },
    attempts: attemptsNow,
    solutionUnlocked: passed || n <= pr.passed || attemptsNow >= SOLUTION_UNLOCK_ATTEMPTS,
    code: newCode,                          // the editor content may change: the next milestone's starter was appended
    unlocked, passedUpTo,
    completed: completedNow || !!pr.completed_at,
    xpAwarded,
    certificate,
  });
});

export default router;
