import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { awardXp, recordActivity } from '../services/activity.js';

const router = Router();
router.use(requireAuth);

router.get('/courses', async (req, res) => {
  const { rows } = await query(
    `SELECT c.slug,c.title,c.description,c.level,
       (SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.id)::int AS total,
       (SELECT COUNT(*) FROM lesson_progress p JOIN lessons l ON l.id=p.lesson_id
          WHERE l.course_id=c.id AND p.user_id=$1 AND p.status='completed')::int AS completed
     FROM courses c ORDER BY c.position`,
    [req.user.id]
  );
  res.json({ courses: rows });
});

router.get('/courses/:course', async (req, res) => {
  const c = await query('SELECT id,slug,title,description,level FROM courses WHERE slug=$1', [req.params.course]);
  if (!c.rows[0]) return res.status(404).json({ error: 'Course not found' });
  const { rows } = await query(
    `SELECT l.slug,l.title,l.position,l.xp, COALESCE(p.status,'not_started') AS status, p.quiz_score
     FROM lessons l LEFT JOIN lesson_progress p ON p.lesson_id=l.id AND p.user_id=$2
     WHERE l.course_id=$1 ORDER BY l.position`,
    [c.rows[0].id, req.user.id]
  );
  res.json({ course: c.rows[0], lessons: rows });
});

async function loadLesson(courseSlug, lessonSlug) {
  const { rows } = await query(
    `SELECT l.*, c.slug AS course_slug, c.title AS course_title
     FROM lessons l JOIN courses c ON c.id=l.course_id WHERE c.slug=$1 AND l.slug=$2`,
    [courseSlug, lessonSlug]
  );
  return rows[0];
}

router.get('/courses/:course/lessons/:lesson', async (req, res) => {
  const l = await loadLesson(req.params.course, req.params.lesson);
  if (!l) return res.status(404).json({ error: 'Lesson not found' });
  const [prog, nav] = await Promise.all([
    query('SELECT status,quiz_score FROM lesson_progress WHERE user_id=$1 AND lesson_id=$2', [req.user.id, l.id]),
    query(
      `SELECT slug,title,position FROM lessons WHERE course_id=$1 AND position IN ($2,$3) ORDER BY position`,
      [l.course_id, l.position - 1, l.position + 1]
    ),
  ]);
  // Never send correct answers to the browser.
  const quiz = l.quiz.map(({ q, options }) => ({ q, options }));
  await query(
    `INSERT INTO lesson_progress(user_id,lesson_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [req.user.id, l.id]
  );
  res.json({
    lesson: {
      slug: l.slug, title: l.title, xp: l.xp, content_md: l.content_md,
      starter_code: l.starter_code, quiz,
      course: { slug: l.course_slug, title: l.course_title },
    },
    progress: prog.rows[0] || { status: 'in_progress', quiz_score: 0 },
    prev: nav.rows.find((n) => n.position === l.position - 1) || null,
    next: nav.rows.find((n) => n.position === l.position + 1) || null,
  });
});

const PASS_RATIO = 0.6;
const answersSchema = z.object({ answers: z.array(z.number().int().min(-1)).max(50) });

router.post('/courses/:course/lessons/:lesson/complete', async (req, res) => {
  const p = answersSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Invalid answers' });
  const l = await loadLesson(req.params.course, req.params.lesson);
  if (!l) return res.status(404).json({ error: 'Lesson not found' });

  const results = l.quiz.map((item, i) => ({
    correct: p.data.answers[i] === item.answer,
    answer: item.answer,
    explain: item.explain || '',
  }));
  const score = results.filter((r) => r.correct).length;
  const total = results.length;
  const passed = total === 0 || score / total >= PASS_RATIO;

  await query(
    `INSERT INTO lesson_progress(user_id,lesson_id,status,quiz_score,completed_at)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id,lesson_id) DO UPDATE SET
       quiz_score = GREATEST(lesson_progress.quiz_score, EXCLUDED.quiz_score),
       status = CASE WHEN lesson_progress.status='completed' OR EXCLUDED.status='completed'
                     THEN 'completed' ELSE 'in_progress' END,
       completed_at = COALESCE(lesson_progress.completed_at, EXCLUDED.completed_at)`,
    [req.user.id, l.id, passed ? 'completed' : 'in_progress', score, passed ? new Date() : null]
  );

  let xpAwarded = 0;
  if (passed) {
    if (await awardXp(req.user.id, l.xp, 'lesson', l.id)) xpAwarded = l.xp;
    await recordActivity(req.user.id);
  }
  res.json({ passed, score, total, results, xpAwarded });
});

export default router;
