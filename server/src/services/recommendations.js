import { query } from '../db.js';

const DIFF_ORDER = "CASE c.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 ELSE 4 END";

/**
 * Rule-based "what should I do next" list, most useful first, at most four items. Every item carries the reason,
 * so the learner can see why it was suggested. No black box: the rules are the code below.
 */
export async function recommendationsFor(userId) {
  const recs = [];
  const add = (r) => { if (recs.length < 4 && !recs.some((x) => x.href === r.href)) recs.push(r); };

  const [next, lessonsDone, activeProject, weak, failedAssessment, untriedAssessment, firstChallenge, newProject, finishedFoundations] = await Promise.all([
    query(
      `SELECT l.slug,l.title,c.slug AS course_slug,c.title AS course_title
       FROM lessons l JOIN courses c ON c.id=l.course_id
       LEFT JOIN lesson_progress p ON p.lesson_id=l.id AND p.user_id=$1 AND p.status='completed'
       WHERE p.lesson_id IS NULL ORDER BY c.position,l.position LIMIT 1`, [userId]),
    query(`SELECT COUNT(*)::int AS n FROM lesson_progress WHERE user_id=$1 AND status='completed'`, [userId]),
    query(
      `SELECT p.slug,p.title,pr.passed,(SELECT COUNT(*) FROM project_milestones m WHERE m.project_id=p.id)::int AS total
       FROM project_progress pr JOIN projects p ON p.id=pr.project_id
       WHERE pr.user_id=$1 AND pr.completed_at IS NULL ORDER BY pr.updated_at DESC LIMIT 1`, [userId]),
    // the category where the learner has tried challenges but solved the smallest share
    query(
      `SELECT c.category, COUNT(*)::int AS tried, COUNT(p.solved_at)::int AS solved,
              (SELECT x.slug FROM challenges x LEFT JOIN challenge_progress xp ON xp.challenge_id=x.id AND xp.user_id=$1
                 WHERE x.category=c.category AND x.published AND xp.solved_at IS NULL
                 ORDER BY CASE x.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 ELSE 4 END, x.position LIMIT 1) AS slug
       FROM challenges c JOIN challenge_progress p ON p.challenge_id=c.id AND p.user_id=$1 AND p.attempts > 0
       WHERE c.published GROUP BY c.category
       HAVING COUNT(p.solved_at) < COUNT(*)
       ORDER BY COUNT(p.solved_at)::float / COUNT(*) ASC, COUNT(*) DESC LIMIT 1`, [userId]),
    query(
      `SELECT a.slug,a.title,MAX(t.score)::float AS best, (a.config->>'pass_percent')::float AS pass,
              (a.config->>'max_attempts')::int AS max_attempts, COUNT(*)::int AS attempts
       FROM assessments a JOIN assessment_attempts t ON t.assessment_id=a.id AND t.user_id=$1 AND t.status='submitted'
       WHERE a.published GROUP BY a.id
       HAVING MAX(t.score) < (a.config->>'pass_percent')::float AND COUNT(*) < COALESCE((a.config->>'max_attempts')::int, 999)
       ORDER BY MAX(t.score) DESC LIMIT 1`, [userId]),
    query(
      `SELECT a.slug,a.title FROM assessments a
       WHERE a.published AND NOT EXISTS (SELECT 1 FROM assessment_attempts t WHERE t.assessment_id=a.id AND t.user_id=$1)
       ORDER BY a.position LIMIT 1`, [userId]),
    query(
      `SELECT c.slug,c.title FROM challenges c LEFT JOIN challenge_progress p ON p.challenge_id=c.id AND p.user_id=$1
       WHERE c.published AND p.solved_at IS NULL ORDER BY ${DIFF_ORDER}, c.position LIMIT 1`, [userId]),
    query(
      `SELECT p.slug,p.title,p.level FROM projects p LEFT JOIN project_progress pr ON pr.project_id=p.id AND pr.user_id=$1
       WHERE p.published AND pr.user_id IS NULL ORDER BY p.position LIMIT 1`, [userId]),
    query(
      `SELECT COUNT(*)::int AS n FROM courses c WHERE c.slug='pytorch-fundamentals' AND
         NOT EXISTS (SELECT 1 FROM lessons l LEFT JOIN lesson_progress p ON p.lesson_id=l.id AND p.user_id=$1 AND p.status='completed'
                     WHERE l.course_id=c.id AND p.lesson_id IS NULL)`, [userId]),
  ]);

  const doneLessons = lessonsDone.rows[0].n;
  if (activeProject.rows[0]) {
    const p = activeProject.rows[0];
    add({ type: 'project', title: `Keep going: ${p.title}`, reason: `You have passed ${p.passed} of ${p.total} milestones.`, href: `/projects/${p.slug}` });
  }
  if (next.rows[0]) {
    const n = next.rows[0];
    add({ type: 'lesson', title: n.title, reason: doneLessons === 0 ? 'A good first lesson: about 10 minutes.' : `Next in ${n.course_title}.`, href: `/learn/${n.course_slug}/${n.slug}` });
  }
  if (weak.rows[0]?.slug) {
    const w = weak.rows[0];
    add({ type: 'practice', title: `Strengthen ${w.category}`, reason: `You tried ${w.tried} ${w.category} challenge${w.tried === 1 ? '' : 's'} and solved ${w.solved}. Here is the easiest one left.`, href: `/practice/${w.slug}` });
  }
  if (failedAssessment.rows[0]) {
    const a = failedAssessment.rows[0];
    add({ type: 'assessment', title: `Retake: ${a.title}`, reason: `Your best score is ${Math.round(a.best)}%; you need ${Math.round(a.pass)}% to pass.`, href: `/assessments/${a.slug}` });
  }
  if (finishedFoundations.rows[0].n > 0 && newProject.rows[0]) {
    const p = newProject.rows[0];
    add({ type: 'project', title: `Build something: ${p.title}`, reason: 'You finished PyTorch Fundamentals. Time to apply it in a project.', href: `/projects/${p.slug}` });
  }
  if (doneLessons >= 3 && untriedAssessment.rows[0]) {
    const a = untriedAssessment.rows[0];
    add({ type: 'assessment', title: `Test yourself: ${a.title}`, reason: 'See how much has stuck so far.', href: `/assessments/${a.slug}` });
  }
  if (doneLessons >= 1 && firstChallenge.rows[0]) {
    const c = firstChallenge.rows[0];
    add({ type: 'practice', title: `Try a challenge: ${c.title}`, reason: 'Practice makes the lessons stick.', href: `/practice/${c.slug}` });
  }
  if (newProject.rows[0]) {
    const p = newProject.rows[0];
    add({ type: 'project', title: `Explore the project: ${p.title}`, reason: 'Projects earn 250 XP and a certificate.', href: `/projects/${p.slug}` });
  }
  return recs;
}
