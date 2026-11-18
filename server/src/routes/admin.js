import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { DIFFICULTIES, XP_BY_DIFFICULTY } from '../services/challengeFormat.js';
import { RunnerError } from '../services/runner.js';
import { ValidationError, checkExercise, checkQuestionData, checkQuiz, slugify } from '../services/contentValidation.js';

const router = Router();
router.use(requireAuth);

// The role is read from the database on every call, so a demotion takes effect immediately
// (the JWT only carries the role it had at sign-in).
router.use(async (req, res, next) => {
  const { rows } = await query('SELECT role FROM users WHERE id=$1', [req.user.id]);
  const role = rows[0]?.role;
  if (role !== 'admin' && role !== 'instructor') return res.status(403).json({ error: 'Staff only' });
  req.role = role;
  next();
});
const adminOnly = (req, res, next) => (req.role === 'admin' ? next() : res.status(403).json({ error: 'Admins only' }));

const bad = (res, msg) => res.status(400).json({ error: msg });
const intId = (v) => (/^\d+$/.test(String(v)) ? Number(v) : null);

// Turn validation problems into 400s and runner problems into 503s, for every handler below.
const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (e) {
    if (e instanceof ValidationError) return bad(res, e.message);
    if (e instanceof RunnerError) return res.status(503).json({ error: `${e.message} The exercise was not saved. Start the runner and try again.` });
    next(e);
  }
};
const friendly = (m) => m.replace(/String must contain at least (\d+) character\(s\)/, 'needs at least $1 characters').replace(/String must contain at most (\d+) character\(s\)/, 'is too long (max $1 characters)').replace(/^Required$/, 'is required');
const zbad = (res, parsed) => bad(res, parsed.error.issues.map((i) => `${i.path.join('.') || 'input'} ${friendly(i.message)}`).join('; '));

// ------------------------------------------------------------------ overview
router.get('/stats', wrap(async (_req, res) => {
  const one = async (sql) => (await query(sql)).rows[0];
  const totals = await one(`SELECT
    (SELECT COUNT(*) FROM users)::int AS users,
    (SELECT COUNT(DISTINCT user_id) FROM learning_streaks WHERE day >= CURRENT_DATE - 6)::int AS active7,
    (SELECT COUNT(DISTINCT user_id) FROM learning_streaks WHERE day = CURRENT_DATE)::int AS active_today,
    (SELECT COUNT(*) FROM lesson_progress WHERE status='completed')::int AS lessons_done,
    (SELECT COUNT(*) FROM challenge_submissions)::int AS submissions,
    (SELECT COUNT(*) FROM challenge_submissions WHERE passed)::int AS submissions_passed,
    (SELECT COUNT(*) FROM assessment_attempts)::int AS attempts,
    (SELECT COUNT(*) FROM certificates)::int AS certificates,
    (SELECT COUNT(*) FROM forum_threads WHERE NOT deleted)::int AS threads,
    (SELECT COUNT(*) FROM code_executions)::int AS runs,
    (SELECT COALESCE(SUM(seconds),0)::int FROM learning_time) AS learning_seconds`);
  const signups = (await query(
    `SELECT to_char(d::date,'YYYY-MM-DD') AS day, COUNT(u.id)::int AS n
     FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, '1 day') d
     LEFT JOIN users u ON u.created_at::date = d::date GROUP BY d ORDER BY d`
  )).rows;
  const activity = (await query(
    `SELECT to_char(d::date,'YYYY-MM-DD') AS day, COUNT(s.user_id)::int AS n
     FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, '1 day') d
     LEFT JOIN learning_streaks s ON s.day = d::date GROUP BY d ORDER BY d`
  )).rows;
  const hardest = (await query(
    `SELECT c.slug, c.title, c.difficulty, COUNT(p.user_id)::int AS learners,
            COUNT(p.solved_at)::int AS solved, COALESCE(SUM(p.attempts),0)::int AS attempts
     FROM challenges c JOIN challenge_progress p ON p.challenge_id = c.id AND p.attempts > 0
     GROUP BY c.id HAVING COUNT(p.user_id) >= 1
     ORDER BY (COUNT(p.solved_at)::float / COUNT(p.user_id)) ASC, COUNT(p.user_id) DESC LIMIT 8`
  )).rows;
  const dropoff = (await query(
    `SELECT c.title AS course, l.title AS lesson, l.position,
            COUNT(*) FILTER (WHERE lp.status='completed')::int AS completed, COUNT(lp.user_id)::int AS started
     FROM lessons l JOIN courses c ON c.id = l.course_id
     LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id
     GROUP BY c.id, c.position, l.id ORDER BY c.position, l.position`
  )).rows.filter((r) => r.started > 0);
  const runner = (await query(
    `SELECT COUNT(*)::int AS runs, COUNT(*) FILTER (WHERE status <> 'success')::int AS failed,
            COALESCE(AVG(runtime_ms),0)::int AS avg_ms
     FROM code_executions WHERE created_at >= now() - interval '7 days'`
  )).rows[0];
  res.json({ totals, signups, activity, hardest, dropoff, runner });
}));

// ------------------------------------------------------------------ users (admins only)
router.get('/users', adminOnly, wrap(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  const page = Math.max(1, intId(req.query.page) || 1);
  const where = q ? "WHERE u.name ILIKE $1 OR u.email ILIKE $1" : '';
  const args = q ? [`%${q.replace(/[%_]/g, '\\$&')}%`] : [];
  const total = (await query(`SELECT COUNT(*)::int AS n FROM users u ${where}`, args)).rows[0].n;
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.role, u.created_at,
            (u.google_id IS NOT NULL) AS google,
            COALESCE((SELECT SUM(amount) FROM xp_transactions x WHERE x.user_id=u.id),0)::int AS xp,
            (SELECT MAX(day) FROM learning_streaks s WHERE s.user_id=u.id) AS last_active
     FROM users u ${where} ORDER BY u.id DESC LIMIT 25 OFFSET ${(page - 1) * 25}`,
    args
  );
  res.json({ users: rows, total, page, pages: Math.max(1, Math.ceil(total / 25)) });
}));

router.patch('/users/:id/role', adminOnly, wrap(async (req, res) => {
  const id = intId(req.params.id);
  const parsed = z.object({ role: z.enum(['student', 'instructor', 'admin']) }).safeParse(req.body);
  if (!id || !parsed.success) return bad(res, 'A valid user and role are required');
  if (id === req.user.id) return bad(res, 'You cannot change your own role. Ask another admin.');
  const r = await query('UPDATE users SET role=$1 WHERE id=$2 RETURNING id,name,email,role', [parsed.data.role, id]);
  if (!r.rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json({ user: r.rows[0] });
}));

// ------------------------------------------------------------------ courses and lessons
router.get('/courses', wrap(async (_req, res) => {
  const courses = (await query('SELECT id,slug,title,description,level,position,source FROM courses ORDER BY position, id')).rows;
  const lessons = (await query('SELECT id,course_id,slug,title,position,xp,source FROM lessons ORDER BY course_id, position, id')).rows;
  res.json({ courses: courses.map((c) => ({ ...c, lessons: lessons.filter((l) => l.course_id === c.id) })) });
}));

const courseSchema = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().max(500).default(''),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced']),
});

router.post('/courses', wrap(async (req, res) => {
  const parsed = courseSchema.extend({ slug: z.string().trim().max(60).optional() }).safeParse(req.body);
  if (!parsed.success) return zbad(res, parsed);
  const slug = slugify(parsed.data.slug || parsed.data.title);
  if (!slug) return bad(res, 'Could not make a URL name from that title');
  const pos = (await query('SELECT COALESCE(MAX(position),0)+1 AS p FROM courses')).rows[0].p;
  const r = await query(
    `INSERT INTO courses(slug,title,description,level,position,source) VALUES ($1,$2,$3,$4,$5,'admin')
     ON CONFLICT (slug) DO NOTHING RETURNING *`,
    [slug, parsed.data.title, parsed.data.description, parsed.data.level, pos]
  );
  if (!r.rows[0]) return bad(res, 'A course with that URL name already exists');
  res.status(201).json({ course: r.rows[0] });
}));

router.put('/courses/:id', wrap(async (req, res) => {
  const id = intId(req.params.id);
  const parsed = courseSchema.safeParse(req.body);
  if (!id || !parsed.success) return parsed.success ? bad(res, 'Bad course id') : zbad(res, parsed);
  const r = await query(
    "UPDATE courses SET title=$1, description=$2, level=$3, source='admin' WHERE id=$4 RETURNING *",
    [parsed.data.title, parsed.data.description, parsed.data.level, id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Course not found' });
  res.json({ course: r.rows[0] });
}));

const lessonSchema = z.object({
  title: z.string().trim().min(3).max(120),
  xp: z.number().int().min(0).max(200),
  content_md: z.string().trim().min(10).max(60000),
  starter_code: z.string().max(20000).default(''),
  quiz: z.array(z.any()).default([]),
});

router.get('/lessons/:id', wrap(async (req, res) => {
  const id = intId(req.params.id);
  const r = id ? await query('SELECT * FROM lessons WHERE id=$1', [id]) : { rows: [] };
  if (!r.rows[0]) return res.status(404).json({ error: 'Lesson not found' });
  res.json({ lesson: r.rows[0] });
}));

router.post('/courses/:id/lessons', wrap(async (req, res) => {
  const courseId = intId(req.params.id);
  const parsed = lessonSchema.extend({ slug: z.string().trim().max(60).optional() }).safeParse(req.body);
  if (!courseId || !parsed.success) return parsed.success ? bad(res, 'Bad course id') : zbad(res, parsed);
  const quiz = checkQuiz(parsed.data.quiz);
  if (!(await query('SELECT 1 FROM courses WHERE id=$1', [courseId])).rows[0]) return res.status(404).json({ error: 'Course not found' });
  const slug = slugify(parsed.data.slug || parsed.data.title);
  const pos = (await query('SELECT COALESCE(MAX(position),0)+1 AS p FROM lessons WHERE course_id=$1', [courseId])).rows[0].p;
  const r = await query(
    `INSERT INTO lessons(course_id,slug,title,position,content_md,starter_code,quiz,xp,source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'admin') ON CONFLICT (course_id,slug) DO NOTHING RETURNING *`,
    [courseId, slug, parsed.data.title, pos, parsed.data.content_md, parsed.data.starter_code, JSON.stringify(quiz), parsed.data.xp]
  );
  if (!r.rows[0]) return bad(res, 'This course already has a lesson with that URL name');
  await query("UPDATE courses SET source='admin' WHERE id=$1", [courseId]);
  res.status(201).json({ lesson: r.rows[0] });
}));

router.put('/lessons/:id', wrap(async (req, res) => {
  const id = intId(req.params.id);
  const parsed = lessonSchema.safeParse(req.body);
  if (!id || !parsed.success) return parsed.success ? bad(res, 'Bad lesson id') : zbad(res, parsed);
  const quiz = checkQuiz(parsed.data.quiz);
  const r = await query(
    `UPDATE lessons SET title=$1, xp=$2, content_md=$3, starter_code=$4, quiz=$5, source='admin' WHERE id=$6 RETURNING *`,
    [parsed.data.title, parsed.data.xp, parsed.data.content_md, parsed.data.starter_code, JSON.stringify(quiz), id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Lesson not found' });
  res.json({ lesson: r.rows[0] });
}));

// ------------------------------------------------------------------ practice challenges
const challengeSchema = z.object({
  title: z.string().trim().min(3).max(100),
  difficulty: z.enum(DIFFICULTIES),
  category: z.string().trim().min(2).max(40),
  description_md: z.string().trim().min(10).max(20000),
  starter_code: z.string().min(1).max(20000),
  solution_code: z.string().min(1).max(20000),
  hints: z.array(z.string().trim().min(1).max(2000)).max(6).default([]),
  tests: z.string().min(10).max(30000),
  published: z.boolean().default(true),
});

router.get('/challenges', wrap(async (_req, res) => {
  const { rows } = await query(
    `SELECT c.id,c.slug,c.title,c.difficulty,c.category,c.xp,c.source,c.published,
            COALESCE(SUM(p.attempts),0)::int AS attempts, COUNT(p.solved_at)::int AS solved
     FROM challenges c LEFT JOIN challenge_progress p ON p.challenge_id=c.id
     GROUP BY c.id ORDER BY c.position, c.id`
  );
  res.json({ challenges: rows });
}));

router.get('/challenges/:id', wrap(async (req, res) => {
  const id = intId(req.params.id);
  const r = id ? await query('SELECT * FROM challenges WHERE id=$1', [id]) : { rows: [] };
  if (!r.rows[0]) return res.status(404).json({ error: 'Challenge not found' });
  res.json({ challenge: r.rows[0] });
}));

/** Dry run: tells the author whether the exercise is sound without saving anything. */
router.post('/challenges/check', wrap(async (req, res) => {
  const parsed = challengeSchema.safeParse(req.body);
  if (!parsed.success) return zbad(res, parsed);
  const info = await checkExercise({ starter: parsed.data.starter_code, solution: parsed.data.solution_code, tests: parsed.data.tests });
  res.json({ ok: true, ...info });
}));

router.post('/challenges', wrap(async (req, res) => {
  const parsed = challengeSchema.extend({ slug: z.string().trim().max(60).optional() }).safeParse(req.body);
  if (!parsed.success) return zbad(res, parsed);
  const d = parsed.data;
  const slug = slugify(d.slug || d.title);
  if (!slug) return bad(res, 'Could not make a URL name from that title');
  await checkExercise({ starter: d.starter_code, solution: d.solution_code, tests: d.tests });
  const pos = (await query('SELECT COALESCE(MAX(position),0)+1 AS p FROM challenges')).rows[0].p;
  const r = await query(
    `INSERT INTO challenges(slug,title,difficulty,category,description_md,starter_code,solution_code,hints,tests,xp,position,source,published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'admin',$12) ON CONFLICT (slug) DO NOTHING RETURNING id,slug`,
    [slug, d.title, d.difficulty, d.category, d.description_md, d.starter_code.trimEnd() + '\n', d.solution_code.trimEnd() + '\n',
      JSON.stringify(d.hints), d.tests.trimEnd() + '\n', XP_BY_DIFFICULTY[d.difficulty], pos, d.published]
  );
  if (!r.rows[0]) return bad(res, 'A challenge with that URL name already exists');
  res.status(201).json({ challenge: r.rows[0] });
}));

router.put('/challenges/:id', wrap(async (req, res) => {
  const id = intId(req.params.id);
  const parsed = challengeSchema.safeParse(req.body);
  if (!id || !parsed.success) return parsed.success ? bad(res, 'Bad challenge id') : zbad(res, parsed);
  const d = parsed.data;
  const cur = (await query('SELECT * FROM challenges WHERE id=$1', [id])).rows[0];
  if (!cur) return res.status(404).json({ error: 'Challenge not found' });
  // Only pay for a runner round trip when something that affects grading changed.
  const norm = (t) => t.trimEnd() + '\n';
  if (norm(d.starter_code) !== cur.starter_code || norm(d.solution_code) !== cur.solution_code || norm(d.tests) !== cur.tests) {
    await checkExercise({ starter: d.starter_code, solution: d.solution_code, tests: d.tests });
  }
  await query(
    `UPDATE challenges SET title=$1,difficulty=$2,category=$3,description_md=$4,starter_code=$5,solution_code=$6,
       hints=$7,tests=$8,xp=$9,published=$10,source='admin' WHERE id=$11`,
    [d.title, d.difficulty, d.category, d.description_md, d.starter_code.trimEnd() + '\n', d.solution_code.trimEnd() + '\n',
      JSON.stringify(d.hints), d.tests.trimEnd() + '\n', XP_BY_DIFFICULTY[d.difficulty], d.published, id]
  );
  res.json({ ok: true });
}));

router.patch('/challenges/:id/published', wrap(async (req, res) => {
  const id = intId(req.params.id);
  const parsed = z.object({ published: z.boolean() }).safeParse(req.body);
  if (!id || !parsed.success) return bad(res, 'published (true/false) is required');
  const r = await query('UPDATE challenges SET published=$1 WHERE id=$2 RETURNING id,published', [parsed.data.published, id]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Challenge not found' });
  res.json(r.rows[0]);
}));

// ------------------------------------------------------------------ assessment question bank
const questionSchema = z.object({
  section: z.enum(['theory', 'coding', 'practical']),
  type: z.enum(['mcq', 'multi', 'code']),
  tags: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
  data: z.any(),
  published: z.boolean().default(true),
});

async function cleanQuestion(body) {
  const parsed = questionSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  const q = parsed.data;
  if (q.type === 'code' && q.section === 'theory') throw new ValidationError('Coding questions belong in the coding or practical section');
  if (q.type !== 'code' && q.section !== 'theory') throw new ValidationError('Multiple-choice questions belong in the theory section');
  const data = checkQuestionData(q.type, q.data);
  if (q.type === 'code') await checkExercise({ starter: data.starter, solution: data.solution, tests: data.tests });
  return { ...q, data };
}

router.get('/questions', wrap(async (req, res) => {
  const args = [];
  const where = [];
  if (['theory', 'coding', 'practical'].includes(req.query.section)) { args.push(req.query.section); where.push(`section=$${args.length}`); }
  const q = String(req.query.q || '').trim().slice(0, 80);
  if (q) { args.push(`%${q.replace(/[%_]/g, '\\$&')}%`); where.push(`(qid ILIKE $${args.length} OR data->>'prompt' ILIKE $${args.length})`); }
  const { rows } = await query(
    `SELECT qid,section,type,tags,source,published,left(data->>'prompt',140) AS prompt
     FROM assessment_questions ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY section, qid LIMIT 300`,
    args
  );
  res.json({ questions: rows });
}));

router.get('/questions/:qid', wrap(async (req, res) => {
  const r = await query('SELECT qid,section,type,tags,data,source,published FROM assessment_questions WHERE qid=$1', [req.params.qid]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Question not found' });
  res.json({ question: r.rows[0] });
}));

router.post('/questions', wrap(async (req, res) => {
  const qid = String(req.body?.qid || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{2,40}$/.test(qid)) return bad(res, 'ID must be 3 to 41 characters: lowercase letters, numbers and dashes (for example t-tensors-20)');
  const q = await cleanQuestion(req.body);
  const r = await query(
    `INSERT INTO assessment_questions(qid,section,type,tags,data,source,published) VALUES ($1,$2,$3,$4,$5,'admin',$6)
     ON CONFLICT (qid) DO NOTHING RETURNING qid`,
    [qid, q.section, q.type, q.tags, JSON.stringify(q.data), q.published]
  );
  if (!r.rows[0]) return bad(res, 'A question with that ID already exists');
  res.status(201).json({ qid });
}));

router.put('/questions/:qid', wrap(async (req, res) => {
  const q = await cleanQuestion(req.body);
  const r = await query(
    `UPDATE assessment_questions SET section=$1,type=$2,tags=$3,data=$4,published=$5,source='admin' WHERE qid=$6 RETURNING qid`,
    [q.section, q.type, q.tags, JSON.stringify(q.data), q.published, req.params.qid]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Question not found' });
  res.json({ ok: true });
}));

router.patch('/questions/:qid/published', wrap(async (req, res) => {
  const parsed = z.object({ published: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return bad(res, 'published (true/false) is required');
  const r = await query('UPDATE assessment_questions SET published=$1 WHERE qid=$2 RETURNING qid', [parsed.data.published, req.params.qid]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Question not found' });
  res.json({ ok: true });
}));

export default router;
