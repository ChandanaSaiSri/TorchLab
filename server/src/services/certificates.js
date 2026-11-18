import crypto from 'node:crypto';
import { query } from '../db.js';

const newCode = () => {
  const h = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `TL-${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}`;
};

/** Issue a certificate once per (user, kind, ref); returns the existing one if already issued. */
export async function issueCertificate(userId, kind, ref, title) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const r = await query(
        `INSERT INTO certificates(code,user_id,kind,ref,title) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (user_id,kind,ref) DO NOTHING RETURNING code,title,issued_at`,
        [newCode(), userId, kind, ref, title]
      );
      if (r.rows[0]) return { ...r.rows[0], isNew: true };
      const existing = await query('SELECT code,title,issued_at FROM certificates WHERE user_id=$1 AND kind=$2 AND ref=$3', [userId, kind, ref]);
      return { ...existing.rows[0], isNew: false };
    } catch (e) {
      if (e.code !== '23505') throw e; // code collision (astronomically rare): try a new code
    }
  }
  throw new Error('Could not issue certificate');
}
