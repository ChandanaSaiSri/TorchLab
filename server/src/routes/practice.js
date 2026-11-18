import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { awardXp, recordActivity } from '../services/activity.js';
import { composeProgram, newNonce, parseResults, summarize } from '../services/challengeFormat.js';

const router = Router();
router.use(requireAuth);

const RUNNER_URL = process.env.RUNNER_URL || 'http://localhost:8000';
const SOLUTION_UNLOCK_ATTEMPTS = 3;

const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: (req) => `u${req.user.id}`,
  message: { error: 'Slow down: max 10 submissions per minute' },
});

router.get('/challenges', async (req, res) => {
  const { rows } = await query(
    `SELECT c.id,c.slug,c.title,c.difficulty,c.category,c.xp,
            COALESCE(p.attempts,0)::int AS attempts, (p.solved_at IS NOT NULL) AS solved
     FROM challenges c LEFT JOIN challenge_progress p ON p.challenge_id=c.id AND p.user_id=$1
     WHERE c.published ORDER BY c.position, c.id`,
    [req.user.id]
  );
  const challenges = rows.map((r) => ({ ...r, status: r.solved ? 'solved' : r.attempts > 0 ? 'attempted' : 'new' }));
  const earned = await query(
    `SELECT COALESCE(SUM(xp_awarded),0)::int AS xp FROM challenge_progress WHERE user_id=$1`,
    [req.user.id]
  );
  const summary = { total: challenges.length, solved: challenges.filter((c) => c.solved).length, xpEarned: earned.rows[0].xp };
  res.json({ challenges, summary });
});

async function loadChallenge(slug) {
  const { rows } = await query('SELECT * FROM challenges WHERE slug=$1 AND published', [slug]);
  return rows[0] || null;
}

async function progressFor(userId, challengeId) {
  const { rows } = await query('SELECT * FROM challenge_progress WHERE user_id=$1 AND challenge_id=$2', [userId, challengeId]);
  return rows[0] || { attempts: 0, hints_used: 0, solution_viewed: false, solved_at: null, xp_awarded: 0, last_code: null };
}

router.get('/challenges/:slug', async (req, res) => {
  const c = await loadChallenge(req.params.slug);
  if (!c) return res.status(404).json({ error: 'Challenge not found' });
  const p = await progressFor(req.user.id, c.id);
  res.json({
    challenge: {
      slug: c.slug, title: c.title, difficulty: c.difficulty, category: c.category, xp: c.xp,
      description_md: c.description_md,
      starter_code: c.starter_code,
      hintsTotal: c.hints.length,
      hints: c.hints.slice(0, p.hints_used),
    },
    progress: {
      attempts: p.attempts,
      solved: !!p.solved_at,
      xpAwarded: p.xp_awarded,
      solutionViewed: p.solution_viewed,
      solutionUnlocked: !!p.solved_at || p.attempts >= SOLUTION_UNLOCK_ATTEMPTS || p.solution_viewed,
      attemptsUntilSolution: Math.max(0, SOLUTION_UNLOCK_ATTEMPTS - p.attempts),
      lastCode: p.last_code,
    },
  });
});

router.post('/challenges/:slug/hint', async (req, res) => {
  const c = await loadChallenge(req.params.slug);
  if (!c) return res.status(404).json({ error: 'Challenge not found' });
  const p = await progressFor(req.user.id, c.id);
  if (p.hints_used >= c.hints.length) return res.status(400).json({ error: 'No more hints for this challenge' });
  const used = p.hints_used + 1;
  await query(
    `INSERT INTO challenge_progress(user_id,challenge_id,hints_used) VALUES ($1,$2,$3)
     ON CONFLICT (user_id,challenge_id) DO UPDATE SET hints_used=EXCLUDED.hints_used`,
    [req.user.id, c.id, used]
  );
  res.json({ hint: c.hints[used - 1], hintsUsed: used, hintsTotal: c.hints.length });
});

router.post('/challenges/:slug/solution', async (req, res) => {
  const c = await loadChallenge(req.params.slug);
  if (!c) return res.status(404).json({ error: 'Challenge not found' });
  const p = await progressFor(req.user.id, c.id);
  const unlocked = !!p.solved_at || p.attempts >= SOLUTION_UNLOCK_ATTEMPTS || p.solution_viewed;
  if (!unlocked) {
    return res.status(403).json({ error: `The solution unlocks after ${SOLUTION_UNLOCK_ATTEMPTS} attempts (you have made ${p.attempts}).` });
  }
  await query(
    `INSERT INTO challenge_progress(user_id,challenge_id,solution_viewed) VALUES ($1,$2,TRUE)
     ON CONFLICT (user_id,challenge_id) DO UPDATE SET solution_viewed=TRUE`,
    [req.user.id, c.id]
  );
  res.json({ solution: c.solution_code, forfeitedXp: !p.solved_at });
});

const submitSchema = z.object({ code: z.string().min(1).max(20000) });

router.post('/challenges/:slug/submit', submitLimiter, async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Code is required (max 20,000 characters)' });
  const c = await loadChallenge(req.params.slug);
  if (!c) return res.status(404).json({ error: 'Challenge not found' });
  const { code } = parsed.data;

  const nonce = newNonce();
  let out;
  try {
    const r = await fetch(`${RUNNER_URL}/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: composeProgram(code, c.tests, nonce) }),
      signal: AbortSignal.timeout(40000),
    });
    if (!r.ok) return res.status(503).json({ error: r.status === 429 ? 'The runner is busy. Try again in a moment.' : 'The runner failed to execute your code.' });
    out = await r.json();
  } catch {
    return res.status(503).json({ error: 'Code runner is unavailable right now.' });
  }

  const { tests, userStdout } = parseResults(out.stdout || '', nonce);
  const summary = tests ? summarize(tests) : null;
  const passed = !!summary?.passed;

  await query(
    `INSERT INTO challenge_submissions(user_id,challenge_id,code,passed,tests_passed,tests_total,status,runtime_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [req.user.id, c.id, code, passed, summary?.testsPassed ?? 0, summary?.testsTotal ?? 0, out.status, out.runtime_ms]
  );
  const before = await progressFor(req.user.id, c.id);
  const firstSolve = passed && !before.solved_at;
  const xpToAward = firstSolve && !before.solution_viewed ? c.xp : 0;
  await query(
    `INSERT INTO challenge_progress(user_id,challenge_id,attempts,last_code,solved_at,xp_awarded)
     VALUES ($1,$2,1,$3,CASE WHEN $4 THEN now() END,$5)
     ON CONFLICT (user_id,challenge_id) DO UPDATE SET
       attempts = challenge_progress.attempts + 1,
       last_code = EXCLUDED.last_code,
       solved_at = COALESCE(challenge_progress.solved_at, EXCLUDED.solved_at),
       xp_awarded = challenge_progress.xp_awarded + EXCLUDED.xp_awarded`,
    [req.user.id, c.id, code, passed, xpToAward]
  );
  let xpAwarded = 0;
  if (xpToAward > 0 && (await awardXp(req.user.id, xpToAward, 'challenge', c.id))) xpAwarded = xpToAward;
  await recordActivity(req.user.id);

  const attempts = before.attempts + 1;
  res.json({
    passed,
    status: out.status,
    runtime_ms: out.runtime_ms,
    stdout: userStdout.slice(0, 8000),
    // When the tests did not run at all (syntax error, crash, timeout) show why.
    runError: tests ? null : (out.stderr || '').slice(-3000) || 'Your program stopped before the tests could run.',
    visible: summary?.visible ?? [],
    hidden: summary?.hidden ?? { total: 0, passed: 0 },
    xpAwarded,
    alreadySolved: !!before.solved_at,
    solvedWithoutSolution: firstSolve ? !before.solution_viewed : undefined,
    attempts,
    solutionUnlocked: passed || !!before.solved_at || attempts >= SOLUTION_UNLOCK_ATTEMPTS || before.solution_viewed,
  });
});

router.get('/challenges/:slug/submissions', async (req, res) => {
  const c = await loadChallenge(req.params.slug);
  if (!c) return res.status(404).json({ error: 'Challenge not found' });
  const { rows } = await query(
    `SELECT id,code,passed,tests_passed,tests_total,status,runtime_ms,created_at
     FROM challenge_submissions WHERE user_id=$1 AND challenge_id=$2 ORDER BY created_at DESC LIMIT 15`,
    [req.user.id, c.id]
  );
  res.json({ submissions: rows });
});

router.get('/stats', async (req, res) => {
  const { rows } = await query(
    `SELECT c.difficulty, c.category,
            COUNT(*)::int AS total, COUNT(p.solved_at)::int AS solved
     FROM challenges c LEFT JOIN challenge_progress p ON p.challenge_id=c.id AND p.user_id=$1
     WHERE c.published GROUP BY c.difficulty, c.category`,
    [req.user.id]
  );
  const byDifficulty = {};
  const byCategory = {};
  for (const r of rows) {
    byDifficulty[r.difficulty] ??= { total: 0, solved: 0 };
    byDifficulty[r.difficulty].total += r.total;
    byDifficulty[r.difficulty].solved += r.solved;
    byCategory[r.category] ??= { total: 0, solved: 0 };
    byCategory[r.category].total += r.total;
    byCategory[r.category].solved += r.solved;
  }
  res.json({ byDifficulty, byCategory });
});

export default router;
