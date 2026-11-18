import { query } from '../db.js';
import { awardXp } from './activity.js';
import { issueCertificate } from './certificates.js';

export const BADGE_XP = 25;

/** What the badge rules look at. One round of queries per sync, shared by all badges. */
export async function loadStats(userId) {
  const [base, courses, autograd, streak] = await Promise.all([
    query(
      `SELECT
         (SELECT COUNT(*) FROM lesson_progress WHERE user_id=$1 AND status='completed')::int AS lessons,
         (SELECT COUNT(*) FROM challenge_progress WHERE user_id=$1 AND solved_at IS NOT NULL)::int AS challenges,
         (SELECT COUNT(*) FROM project_progress WHERE user_id=$1 AND completed_at IS NOT NULL)::int AS projects_done,
         (SELECT COUNT(*) FROM project_progress WHERE user_id=$1)::int AS projects_started,
         (SELECT COUNT(*) FROM projects WHERE published)::int AS projects_total,
         (SELECT COALESCE(MAX(score),0) FROM assessment_attempts WHERE user_id=$1 AND status='submitted')::float AS best_assessment,
         (SELECT COALESCE(SUM(amount),0) FROM xp_transactions WHERE user_id=$1)::int AS xp`,
      [userId]
    ),
    query(
      `SELECT c.slug, c.title,
         (SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.id)::int AS total,
         (SELECT COUNT(*) FROM lesson_progress p JOIN lessons l ON l.id=p.lesson_id
            WHERE l.course_id=c.id AND p.user_id=$1 AND p.status='completed')::int AS completed
       FROM courses c`,
      [userId]
    ),
    query(
      `SELECT COUNT(*)::int AS total, COUNT(p.solved_at)::int AS solved
       FROM challenges c LEFT JOIN challenge_progress p ON p.challenge_id=c.id AND p.user_id=$1
       WHERE c.published AND c.category='Autograd'`,
      [userId]
    ),
    query(
      `SELECT COALESCE(MAX(n),0)::int AS longest FROM (
         SELECT COUNT(*) AS n FROM (
           SELECT day - (ROW_NUMBER() OVER (ORDER BY day))::int AS grp FROM learning_streaks WHERE user_id=$1
         ) t GROUP BY grp
       ) s`,
      [userId]
    ),
  ]);
  const courseRows = courses.rows;
  return {
    ...base.rows[0],
    courses: courseRows,
    courses_total: courseRows.length,
    courses_done: courseRows.filter((c) => c.total > 0 && c.completed >= c.total).length,
    autograd_total: autograd.rows[0].total,
    autograd_solved: autograd.rows[0].solved,
    longest_streak: streak.rows[0].longest,
  };
}

const course = (s, slug) => s.courses.find((c) => c.slug === slug) || { completed: 0, total: 1 };

/** Each rule reports progress as {current, target}; the badge is earned once current >= target. */
export const BADGES = [
  { code: 'first-steps', name: 'First Steps', icon: '👣', category: 'Learning', description: 'Complete your first lesson.',
    progress: (s) => ({ current: s.lessons, target: 1 }) },
  { code: 'tensor-master', name: 'Tensor Master', icon: '🧮', category: 'Learning', description: 'Finish every lesson of PyTorch Fundamentals.',
    progress: (s) => ({ current: course(s, 'pytorch-fundamentals').completed, target: Math.max(1, course(s, 'pytorch-fundamentals').total) }) },
  { code: 'gradient-guru', name: 'Gradient Guru', icon: '📉', category: 'Practice', description: 'Solve every Autograd challenge in the Practice Arena.',
    progress: (s) => ({ current: s.autograd_solved, target: Math.max(1, s.autograd_total) }) },
  { code: 'model-builder', name: 'Model Builder', icon: '🏗️', category: 'Projects', description: 'Complete your first Live Project.',
    progress: (s) => ({ current: s.projects_done, target: 1 }) },
  { code: 'project-explorer', name: 'Project Explorer', icon: '🧭', category: 'Projects', description: 'Start every Live Project.',
    progress: (s) => ({ current: s.projects_started, target: Math.max(1, s.projects_total) }) },
  { code: 'pytorch-pro', name: 'PyTorch Pro', icon: '🏆', category: 'Mastery', description: 'Complete every course and every Live Project.',
    progress: (s) => ({ current: s.courses_done + s.projects_done, target: Math.max(1, s.courses_total + s.projects_total) }) },
  { code: 'consistency-champion', name: 'Consistency Champion', icon: '🔥', category: 'Habits', description: 'Learn on 7 days in a row.',
    progress: (s) => ({ current: s.longest_streak, target: 7 }) },
  { code: 'challenge-crusher', name: 'Challenge Crusher', icon: '⚔️', category: 'Practice', description: 'Solve 10 Practice Arena challenges.',
    progress: (s) => ({ current: s.challenges, target: 10 }) },
  { code: 'assessment-ace', name: 'Assessment Ace', icon: '🎯', category: 'Assessments', description: 'Score 90% or more on an assessment.',
    progress: (s) => ({ current: Math.floor(s.best_assessment), target: 90 }) },
  { code: 'rising-star', name: 'Rising Star', icon: '⭐', category: 'Mastery', description: 'Earn 1,000 XP.',
    progress: (s) => ({ current: s.xp, target: 1000 }) },
];

/**
 * Re-evaluate everything for one learner: award newly earned badges (+25 XP each, once) and issue a
 * certificate for every course whose lessons are all complete. Idempotent, so it is safe to call after any activity.
 */
export async function syncAchievements(userId) {
  const stats = await loadStats(userId);
  const newBadges = [];
  for (const b of BADGES) {
    const p = b.progress(stats);
    if (p.current < p.target) continue;
    const r = await query('INSERT INTO user_badges(user_id,code) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING code', [userId, b.code]);
    if (r.rowCount) {
      newBadges.push(b.code);
      await awardXp(userId, BADGE_XP, 'badge', b.code);
    }
  }
  const newCertificates = [];
  for (const c of stats.courses) {
    if (c.total > 0 && c.completed >= c.total) {
      const cert = await issueCertificate(userId, 'course', c.slug, `${c.title} - Course Completion`);
      if (cert.isNew) newCertificates.push(cert.code);
    }
  }
  return { newBadges, newCertificates };
}

export async function achievementsFor(userId) {
  const stats = await loadStats(userId);
  const earned = new Map((await query('SELECT code,earned_at FROM user_badges WHERE user_id=$1', [userId])).rows.map((r) => [r.code, r.earned_at]));
  return {
    badges: BADGES.map((b) => {
      const p = b.progress(stats);
      return {
        code: b.code, name: b.name, icon: b.icon, category: b.category, description: b.description, xp: BADGE_XP,
        earned: earned.has(b.code), earnedAt: earned.get(b.code) || null,
        current: Math.min(p.current, p.target), target: p.target,
      };
    }),
    stats: { lessons: stats.lessons, challenges: stats.challenges, projects: stats.projects_done, streak: stats.longest_streak, xp: stats.xp },
  };
}
