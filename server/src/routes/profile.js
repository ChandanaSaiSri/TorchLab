import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { totalXp, getStreak } from '../services/activity.js';
import { levelFor } from '../services/levels.js';
import { achievementsFor } from '../services/achievements.js';

const router = Router();
router.use(requireAuth);

/**
 * Learning-time heartbeat. The client calls this every ~30 s while the tab is visible and the learner is active.
 * Time is credited from the gap since the previous beat (capped at 90 s, ignored beyond that), so calling it more
 * often cannot add more time than actually passed.
 */
router.post('/heartbeat', async (req, res) => {
  await query(
    `INSERT INTO learning_time(user_id, day, seconds, last_beat) VALUES ($1, CURRENT_DATE, 0, now())
     ON CONFLICT (user_id, day) DO UPDATE SET
       seconds = learning_time.seconds + CASE
         WHEN now() - learning_time.last_beat <= interval '90 seconds' THEN EXTRACT(EPOCH FROM now() - learning_time.last_beat)::int
         ELSE 0 END,
       last_beat = now()`,
    [req.user.id]
  );
  res.json({ ok: true });
});

router.get('/summary', async (req, res) => {
  const uid = req.user.id;
  const [xp, streak, time, week, heat, counts, assess, certs, ach] = await Promise.all([
    totalXp(uid),
    getStreak(uid),
    query('SELECT COALESCE(SUM(seconds),0)::int AS s FROM learning_time WHERE user_id=$1', [uid]),
    query(
      `SELECT to_char(d::date,'YYYY-MM-DD') AS day, COALESCE(t.seconds,0)::int AS seconds
       FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, interval '1 day') d
       LEFT JOIN learning_time t ON t.user_id=$1 AND t.day=d::date ORDER BY d`, [uid]),
    // activity heatmap: days with learning activity, weighted by how many things were earned that day
    query(
      `SELECT to_char(day,'YYYY-MM-DD') AS day, SUM(n)::int AS count FROM (
         SELECT day, 1 AS n FROM learning_streaks WHERE user_id=$1 AND day > CURRENT_DATE - 364
         UNION ALL
         SELECT created_at::date AS day, 1 AS n FROM xp_transactions WHERE user_id=$1 AND created_at::date > CURRENT_DATE - 364
       ) t GROUP BY day ORDER BY day`, [uid]),
    query(
      `SELECT
         (SELECT COUNT(*) FROM lesson_progress WHERE user_id=$1 AND status='completed')::int AS lessons,
         (SELECT COUNT(*) FROM challenge_progress WHERE user_id=$1 AND solved_at IS NOT NULL)::int AS challenges,
         (SELECT COUNT(*) FROM project_progress WHERE user_id=$1 AND completed_at IS NOT NULL)::int AS projects,
         (SELECT COUNT(*) FROM assessment_attempts WHERE user_id=$1 AND status='submitted' AND passed)::int AS assessments_passed`, [uid]),
    query(
      `SELECT a.slug,a.title,MAX(t.score)::float AS best,COUNT(*)::int AS attempts,bool_or(t.passed) AS passed
       FROM assessment_attempts t JOIN assessments a ON a.id=t.assessment_id
       WHERE t.user_id=$1 AND t.status='submitted' GROUP BY a.id ORDER BY a.position`, [uid]),
    query('SELECT code,kind,title,issued_at FROM certificates WHERE user_id=$1 ORDER BY issued_at DESC', [uid]),
    achievementsFor(uid),
  ]);
  const level = levelFor(xp);
  res.json({
    level, streak,
    xp,
    hours: {
      totalSeconds: time.rows[0].s,
      week: week.rows,
      weekSeconds: week.rows.reduce((a, r) => a + r.seconds, 0),
    },
    heatmap: heat.rows,
    counts: counts.rows[0],
    assessments: assess.rows,
    certificates: certs.rows,
    badges: ach.badges.filter((b) => b.earned).map((b) => ({ code: b.code, name: b.name, icon: b.icon })),
  });
});

export default router;
