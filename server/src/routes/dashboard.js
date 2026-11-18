import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { getStreak, totalXp } from '../services/activity.js';
import { levelFor } from '../services/levels.js';
import { recommendationsFor } from '../services/recommendations.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const uid = req.user.id;
  const [xp, streak, cont, courses, runs, recent, assessments, projects, recommendations] = await Promise.all([
    totalXp(uid),
    getStreak(uid),
    query(
      `SELECT l.slug,l.title,c.slug AS course_slug,c.title AS course_title
       FROM lessons l JOIN courses c ON c.id=l.course_id
       LEFT JOIN lesson_progress p ON p.lesson_id=l.id AND p.user_id=$1 AND p.status='completed'
       WHERE p.lesson_id IS NULL ORDER BY c.position,l.position LIMIT 1`,
      [uid]
    ),
    query(
      `SELECT c.slug,c.title,
         (SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.id)::int AS total,
         (SELECT COUNT(*) FROM lesson_progress p JOIN lessons l ON l.id=p.lesson_id
            WHERE l.course_id=c.id AND p.user_id=$1 AND p.status='completed')::int AS completed
       FROM courses c ORDER BY c.position`,
      [uid]
    ),
    query(
      `SELECT id,status,runtime_ms,created_at,left(code,80) AS preview
       FROM code_executions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5`,
      [uid]
    ),
    query(
      `SELECT l.title,c.slug AS course_slug,l.slug,p.quiz_score,p.completed_at
       FROM lesson_progress p JOIN lessons l ON l.id=p.lesson_id JOIN courses c ON c.id=l.course_id
       WHERE p.user_id=$1 AND p.status='completed' ORDER BY p.completed_at DESC LIMIT 5`,
      [uid]
    ),
    query(
      `SELECT a.slug,a.title,MAX(t.score)::float AS best,COUNT(*)::int AS attempts,bool_or(t.passed) AS passed,
              (a.config->>'pass_percent')::float AS pass
       FROM assessment_attempts t JOIN assessments a ON a.id=t.assessment_id
       WHERE t.user_id=$1 AND t.status='submitted' GROUP BY a.id ORDER BY MAX(t.submitted_at) DESC LIMIT 4`,
      [uid]
    ),
    query(
      `SELECT p.slug,p.title,pr.passed,(SELECT COUNT(*) FROM project_milestones m WHERE m.project_id=p.id)::int AS total
       FROM project_progress pr JOIN projects p ON p.id=pr.project_id
       WHERE pr.user_id=$1 AND pr.completed_at IS NULL ORDER BY pr.updated_at DESC LIMIT 4`,
      [uid]
    ),
    recommendationsFor(uid),
  ]);
  const done = courses.rows.reduce((a, c) => a + c.completed, 0);
  const all = courses.rows.reduce((a, c) => a + c.total, 0);
  res.json({
    xp,
    level: levelFor(xp),
    assessments: assessments.rows,
    projects: projects.rows,
    recommendations,
    streak,
    overall: { completed: done, total: all },
    continue: cont.rows[0] || null,
    courses: courses.rows,
    recentRuns: runs.rows,
    recentLessons: recent.rows,
  });
});

export default router;
