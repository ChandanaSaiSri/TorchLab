import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

async function portfolioFor(userId) {
  const user = (await query('SELECT u.id,u.name,p.bio,p.portfolio_public FROM users u LEFT JOIN user_profiles p ON p.user_id=u.id WHERE u.id=$1', [userId])).rows[0];
  if (!user) return null;
  const projects = (
    await query(
      `SELECT p.slug,p.title,p.level,p.summary,p.skills,pr.completed_at,pr.code,c.code AS certificate
       FROM project_progress pr JOIN projects p ON p.id=pr.project_id
       LEFT JOIN certificates c ON c.user_id=pr.user_id AND c.kind='project' AND c.ref=p.slug
       WHERE pr.user_id=$1 AND pr.completed_at IS NOT NULL ORDER BY pr.completed_at DESC`,
      [userId]
    )
  ).rows;
  const certificates = (await query('SELECT code,kind,title,issued_at FROM certificates WHERE user_id=$1 ORDER BY issued_at DESC', [userId])).rows;
  const skills = [...new Set(projects.flatMap((p) => p.skills))];
  return { user: { id: user.id, name: user.name, bio: user.bio || '' }, public: !!user.portfolio_public, projects, certificates, skills };
}

router.get('/me', requireAuth, async (req, res) => {
  res.json(await portfolioFor(req.user.id));
});

router.put('/me', requireAuth, async (req, res) => {
  const isPublic = req.body?.public === true;
  await query(
    `INSERT INTO user_profiles(user_id,portfolio_public) VALUES ($1,$2)
     ON CONFLICT (user_id) DO UPDATE SET portfolio_public=EXCLUDED.portfolio_public`,
    [req.user.id, isPublic]
  );
  res.json({ public: isPublic });
});

/** Public portfolio, only when its owner has switched sharing on. */
router.get('/u/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Portfolio not found' });
  const data = await portfolioFor(id);
  if (!data || !data.public) return res.status(404).json({ error: 'Portfolio not found' });
  res.json({ ...data, isOwner: false });
});

export default router;
