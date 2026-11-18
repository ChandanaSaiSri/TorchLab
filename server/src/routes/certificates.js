import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

/** Public: anyone with a code can check that a certificate is genuine. */
router.get('/verify/:code', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  if (!/^TL-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(code)) return res.status(404).json({ valid: false });
  const { rows } = await query(
    `SELECT c.code,c.kind,c.title,c.issued_at,u.name FROM certificates c JOIN users u ON u.id=c.user_id WHERE c.code=$1`,
    [code]
  );
  if (!rows[0]) return res.status(404).json({ valid: false });
  const r = rows[0];
  res.json({ valid: true, code: r.code, kind: r.kind, title: r.title, issuedAt: r.issued_at, name: r.name });
});

router.get('/mine', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT code,kind,ref,title,issued_at FROM certificates WHERE user_id=$1 ORDER BY issued_at DESC', [req.user.id]);
  res.json({ certificates: rows });
});

export default router;
