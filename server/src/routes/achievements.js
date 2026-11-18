import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { achievementsFor, syncAchievements, BADGES } from '../services/achievements.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  await syncAchievements(req.user.id);   // also catches progress made before badges existed
  const data = await achievementsFor(req.user.id);
  const certs = await query('SELECT code,kind,ref,title,issued_at FROM certificates WHERE user_id=$1 ORDER BY issued_at DESC', [req.user.id]);
  res.json({ ...data, certificates: certs.rows });
});

/** Badges earned since the learner last looked: the client shows a toast once, then they are marked seen. */
router.get('/unseen', async (req, res) => {
  const r = await query('UPDATE user_badges SET seen=TRUE WHERE user_id=$1 AND seen=FALSE RETURNING code', [req.user.id]);
  const byCode = new Map(BADGES.map((b) => [b.code, b]));
  res.json({ badges: r.rows.map((x) => byCode.get(x.code)).filter(Boolean).map((b) => ({ code: b.code, name: b.name, icon: b.icon, description: b.description })) });
});

export default router;
