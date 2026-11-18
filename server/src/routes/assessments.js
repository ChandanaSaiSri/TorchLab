import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { awardXp, recordActivity } from '../services/activity.js';
import { runProgram, RunnerError } from '../services/runner.js';
import { composeProgram, newNonce, parseResults, summarize } from '../services/challengeFormat.js';
import {
  buildLayout, publicQuestion, scoreMcq, scoreMulti, reviewChoice, combine, SECTION_ORDER,
} from '../services/assessmentEngine.js';

const router = Router();
router.use(requireAuth);

const GRACE_MS = 20_000; // network slack on top of the deadline
const MAX_CODE = 20_000;

const parse = (row) => ({ ...row, score: row.score === null ? null : Number(row.score) });

async function loadAssessment(slug) {
  const { rows } = await query('SELECT * FROM assessments WHERE slug=$1 AND published', [slug]);
  return rows[0] || null;
}

async function bankFor(qids) {
  if (!qids.length) return new Map();
  const { rows } = await query('SELECT qid,section,type,tags,data FROM assessment_questions WHERE qid = ANY($1)', [qids]);
  return new Map(rows.map((r) => [r.qid, r]));
}

function secondsLeft(attempt) {
  return Math.max(0, Math.round((new Date(attempt.deadline).getTime() - Date.now()) / 1000));
}

/** Check answers for shape and size. Returns a cleaned copy or null. */
function cleanAnswers(raw, layout) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const allowed = new Map(layout.map((i) => [i.qid, i]));
  const out = {};
  for (const [qid, v] of Object.entries(raw)) {
    const item = allowed.get(qid);
    if (!item) continue;
    if (v === null) continue;
    if (typeof v === 'string') {
      if (item.order) return null;
      out[qid] = v.slice(0, MAX_CODE);
    } else if (typeof v === 'number') {
      if (!item.order || !Number.isInteger(v) || v < 0 || v >= item.order.length) return null;
      out[qid] = v;
    } else if (Array.isArray(v)) {
      if (!item.order || v.length > item.order.length || !v.every((d) => Number.isInteger(d) && d >= 0 && d < item.order.length)) return null;
      out[qid] = [...new Set(v)];
    } else return null;
  }
  return out;
}

async function attemptPayload(attempt, assessment) {
  const bank = await bankFor(attempt.layout.map((i) => i.qid));
  const questions = attempt.layout.map((item) => publicQuestion(bank.get(item.qid), item));
  const c = assessment.config;
  return {
    attempt: { id: attempt.id, status: attempt.status, startedAt: attempt.started_at, deadline: attempt.deadline, secondsLeft: secondsLeft(attempt) },
    assessment: {
      slug: assessment.slug, title: assessment.title, kind: assessment.kind, timeLimitMin: c.time_limit_min,
      passPercent: c.pass_percent, negativeMarking: c.negative_marking || 0,
    },
    questions,
    answers: attempt.answers,
  };
}

async function gradeCode(q, code) {
  const possible = q.data.points ?? 10;
  if (!code || !code.trim()) return { earned: 0, possible, status: 'unanswered', code: { tests: [], hidden: { total: 0, passed: 0 }, runError: null } };
  const nonce = newNonce();
  const out = await runProgram(composeProgram(code, q.data.tests, nonce)); // may throw RunnerError
  const { tests } = parseResults(out.stdout || '', nonce);
  if (!tests) {
    return {
      earned: 0, possible, status: 'wrong',
      code: { tests: [], hidden: { total: 0, passed: 0 }, runError: ((out.stderr || '').slice(-1500)) || 'The program stopped before the tests could run.' },
    };
  }
  const s = summarize(tests);
  const frac = s.testsTotal ? s.testsPassed / s.testsTotal : 0;
  return {
    earned: +(possible * frac).toFixed(4), possible,
    status: s.passed ? 'correct' : frac > 0 ? 'partial' : 'wrong',
    code: { tests: s.visible, hidden: s.hidden, runError: null, testsPassed: s.testsPassed, testsTotal: s.testsTotal },
  };
}

/** Grade an attempt, store the result and award XP once. Returns the stored attempt row, or throws RunnerError. */
async function finalize(attempt, assessment, answers, timedOut) {
  // claim: only one request may grade an attempt (a stale claim older than 3 minutes can be retaken)
  const claim = await query(
    `UPDATE assessment_attempts SET status='grading', claimed_at=now()
     WHERE id=$1 AND (status='in_progress' OR (status='grading' AND claimed_at < now() - interval '3 minutes')) RETURNING id`,
    [attempt.id]
  );
  if (!claim.rowCount) return null;

  const cfg = assessment.config;
  const negative = cfg.negative_marking || 0;
  try {
    const bank = await bankFor(attempt.layout.map((i) => i.qid));
    const results = [];
    for (const item of attempt.layout) {
      const q = bank.get(item.qid);
      const ans = answers[item.qid];
      let r;
      if (q.type === 'mcq') r = { ...scoreMcq({ data: q.data }, item, ans ?? null, negative), review: reviewChoice(q, item, ans) };
      else if (q.type === 'multi') r = { ...scoreMulti({ data: q.data }, item, ans), review: reviewChoice(q, item, ans) };
      else r = await gradeCode(q, ans);
      results.push({ qid: q.qid, section: q.section, type: q.type, prompt: q.data.title || q.data.prompt, ...r });
    }
    const combined = combine(results);
    const passed = combined.percent >= cfg.pass_percent;
    const result = {
      percent: combined.percent, passed, passPercent: cfg.pass_percent, sections: combined.sections,
      negativeMarking: negative, timedOut: !!timedOut, questions: results,
    };
    const upd = await query(
      `UPDATE assessment_attempts SET status='submitted', submitted_at=now(), answers=$2, result=$3, score=$4, passed=$5
       WHERE id=$1 RETURNING *`,
      [attempt.id, JSON.stringify(answers), JSON.stringify(result), combined.percent, passed]
    );
    let xpAwarded = 0;
    if (passed && cfg.xp && (await awardXp(attempt.user_id, cfg.xp, 'assessment', assessment.slug))) xpAwarded = cfg.xp;
    if (xpAwarded) {
      result.xpAwarded = xpAwarded;
      await query('UPDATE assessment_attempts SET result=$2 WHERE id=$1', [attempt.id, JSON.stringify(result)]);
    }
    await recordActivity(attempt.user_id);
    return { ...upd.rows[0], result };
  } catch (e) {
    await query(`UPDATE assessment_attempts SET status='in_progress', claimed_at=NULL WHERE id=$1 AND status='grading'`, [attempt.id]);
    throw e;
  }
}

function resultView(attempt, assessment) {
  const r = attempt.result;
  const orderIdx = (s) => SECTION_ORDER.indexOf(s);
  return {
    attempt: { id: attempt.id, status: attempt.status, startedAt: attempt.started_at, submittedAt: attempt.submitted_at },
    assessment: { slug: assessment.slug, title: assessment.title, kind: assessment.kind, passPercent: assessment.config.pass_percent },
    result: {
      ...r,
      questions: [...r.questions].sort((a, b) => orderIdx(a.section) - orderIdx(b.section)),
    },
  };
}

// ------------------------------------------------------------------ routes

router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT a.*,
       (SELECT COUNT(*)::int FROM assessment_attempts t WHERE t.assessment_id=a.id AND t.user_id=$1) AS used,
       (SELECT MAX(score) FROM assessment_attempts t WHERE t.assessment_id=a.id AND t.user_id=$1 AND t.status='submitted') AS best,
       (SELECT BOOL_OR(passed) FROM assessment_attempts t WHERE t.assessment_id=a.id AND t.user_id=$1 AND t.status='submitted') AS passed,
       (SELECT id FROM assessment_attempts t WHERE t.assessment_id=a.id AND t.user_id=$1 AND t.status IN ('in_progress','grading') LIMIT 1) AS open_attempt
     FROM assessments a WHERE a.published ORDER BY a.position, a.id`,
    [req.user.id]
  );
  res.json({
    assessments: rows.map((a) => ({
      slug: a.slug, title: a.title, kind: a.kind, description: a.description,
      timeLimitMin: a.config.time_limit_min, passPercent: a.config.pass_percent, maxAttempts: a.config.max_attempts,
      negativeMarking: a.config.negative_marking || 0, xp: a.config.xp,
      sections: a.config.sections.map((s) => ({ name: s.name, count: s.pick })),
      attemptsUsed: a.used, bestScore: a.best === null ? null : Number(a.best), passed: !!a.passed, openAttemptId: a.open_attempt,
    })),
  });
});

router.get('/attempts/:id', async (req, res) => {
  const { rows } = await query('SELECT * FROM assessment_attempts WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  let attempt = rows[0];
  if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
  const { rows: ar } = await query('SELECT * FROM assessments WHERE id=$1', [attempt.assessment_id]);
  const assessment = ar[0];
  // Time ran out while the learner was away: grade what was saved.
  if (attempt.status !== 'submitted' && Date.now() > new Date(attempt.deadline).getTime() + GRACE_MS) {
    try {
      const done = await finalize(attempt, assessment, attempt.answers, true);
      if (done) attempt = done;
    } catch (e) {
      if (e instanceof RunnerError) return res.status(503).json({ error: e.message });
      throw e;
    }
    const again = await query('SELECT * FROM assessment_attempts WHERE id=$1', [attempt.id]);
    attempt = again.rows[0];
  }
  if (attempt.status === 'submitted') return res.json({ state: 'submitted', ...resultView(attempt, assessment) });
  if (attempt.status === 'grading') return res.status(409).json({ error: 'This attempt is being graded. Reload in a few seconds.' });
  res.json({ state: 'in_progress', ...(await attemptPayload(attempt, assessment)) });
});

router.get('/:slug', async (req, res) => {
  const a = await loadAssessment(req.params.slug);
  if (!a) return res.status(404).json({ error: 'Assessment not found' });
  const { rows } = await query(
    `SELECT id,status,started_at,submitted_at,score,passed FROM assessment_attempts
     WHERE user_id=$1 AND assessment_id=$2 ORDER BY started_at DESC`,
    [req.user.id, a.id]
  );
  const c = a.config;
  res.json({
    assessment: {
      slug: a.slug, title: a.title, kind: a.kind, description: a.description, timeLimitMin: c.time_limit_min,
      passPercent: c.pass_percent, maxAttempts: c.max_attempts, negativeMarking: c.negative_marking || 0, xp: c.xp,
      sections: c.sections.map((s) => ({ name: s.name, count: s.pick })),
    },
    attempts: rows.map(parse),
    attemptsLeft: c.max_attempts > 0 ? Math.max(0, c.max_attempts - rows.length) : null,
  });
});

router.post('/:slug/start', async (req, res) => {
  const a = await loadAssessment(req.params.slug);
  if (!a) return res.status(404).json({ error: 'Assessment not found' });

  let { rows } = await query(`SELECT * FROM assessment_attempts WHERE user_id=$1 AND assessment_id=$2 AND status IN ('in_progress','grading')`, [req.user.id, a.id]);
  let open = rows[0];
  if (open && Date.now() > new Date(open.deadline).getTime() + GRACE_MS) {
    try {
      await finalize(open, a, open.answers, true);
    } catch (e) {
      if (e instanceof RunnerError) return res.status(503).json({ error: e.message });
      throw e;
    }
    open = null;
  }
  if (open) {
    if (open.status === 'grading') return res.status(409).json({ error: 'Your previous attempt is still being graded.' });
    return res.json(await attemptPayload(open, a));
  }

  const used = (await query('SELECT COUNT(*)::int AS n FROM assessment_attempts WHERE user_id=$1 AND assessment_id=$2', [req.user.id, a.id])).rows[0].n;
  if (a.config.max_attempts > 0 && used >= a.config.max_attempts) {
    return res.status(403).json({ error: `You have used all ${a.config.max_attempts} attempts for this assessment.` });
  }
  const { rows: bank } = await query('SELECT qid,section,type,tags,data,published FROM assessment_questions WHERE published');
  const layout = buildLayout(a.config, bank);
  if (!layout.length) return res.status(500).json({ error: 'This assessment has no questions yet.' });
  const deadline = new Date(Date.now() + a.config.time_limit_min * 60_000);
  try {
    const ins = await query(
      `INSERT INTO assessment_attempts(user_id,assessment_id,deadline,layout) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.id, a.id, deadline, JSON.stringify(layout)]
    );
    await recordActivity(req.user.id);
    res.status(201).json(await attemptPayload(ins.rows[0], a));
  } catch (e) {
    if (e.code === '23505') {
      // a second tab started at the same moment: return the one that won
      const w = await query(`SELECT * FROM assessment_attempts WHERE user_id=$1 AND assessment_id=$2 AND status='in_progress'`, [req.user.id, a.id]);
      if (w.rows[0]) return res.json(await attemptPayload(w.rows[0], a));
    }
    throw e;
  }
});

router.put('/attempts/:id/answers', async (req, res) => {
  const { rows } = await query('SELECT * FROM assessment_attempts WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  const attempt = rows[0];
  if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
  if (attempt.status !== 'in_progress') return res.status(409).json({ error: 'This attempt is already submitted.' });
  if (Date.now() > new Date(attempt.deadline).getTime() + GRACE_MS) return res.status(409).json({ error: 'Time is up.', timeUp: true });
  const answers = cleanAnswers(req.body?.answers, attempt.layout);
  if (!answers) return res.status(400).json({ error: 'Invalid answers' });
  await query(`UPDATE assessment_attempts SET answers=$2 WHERE id=$1 AND status='in_progress'`, [attempt.id, JSON.stringify(answers)]);
  res.json({ ok: true, secondsLeft: secondsLeft(attempt) });
});

router.post('/attempts/:id/submit', async (req, res) => {
  const { rows } = await query('SELECT * FROM assessment_attempts WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  const attempt = rows[0];
  if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
  const { rows: ar } = await query('SELECT * FROM assessments WHERE id=$1', [attempt.assessment_id]);
  const assessment = ar[0];
  if (attempt.status === 'submitted') return res.json({ state: 'submitted', ...resultView(attempt, assessment) });

  const late = Date.now() > new Date(attempt.deadline).getTime() + GRACE_MS;
  let answers = attempt.answers;
  if (!late && req.body?.answers) {
    const cleaned = cleanAnswers(req.body.answers, attempt.layout);
    if (!cleaned) return res.status(400).json({ error: 'Invalid answers' });
    answers = cleaned;
  }
  try {
    const done = await finalize(attempt, assessment, answers, late || Date.now() > new Date(attempt.deadline).getTime());
    if (!done) return res.status(409).json({ error: 'This attempt is already being graded.' });
    res.json({ state: 'submitted', ...resultView(done, assessment) });
  } catch (e) {
    if (e instanceof RunnerError) return res.status(503).json({ error: `${e.message} Your answers are saved: press Submit again.` });
    throw e;
  }
});

export default router;
