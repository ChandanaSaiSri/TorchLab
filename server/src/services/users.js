import { query } from '../db.js';

/**
 * Resolve a verified Google identity to a TorchLab user.
 * 1. Already linked by Google id -> that user.
 * 2. An account with the same (Google-verified) email exists -> link it.
 * 3. Otherwise create a new account with no password.
 */
export async function findOrCreateGoogleUser({ sub, email, name, picture }) {
  const mail = String(email).toLowerCase();

  let r = await query('SELECT * FROM users WHERE google_id=$1', [sub]);
  if (r.rows[0]) return r.rows[0];

  r = await query('SELECT * FROM users WHERE email=$1', [mail]);
  if (r.rows[0]) {
    const linked = await query('UPDATE users SET google_id=$1, email_verified=TRUE WHERE id=$2 RETURNING *', [sub, r.rows[0].id]);
    return linked.rows[0];
  }

  const created = await query(
    'INSERT INTO users(name,email,google_id,email_verified) VALUES ($1,$2,$3,TRUE) RETURNING *',
    [(name || mail.split('@')[0]).slice(0, 80), mail, sub]
  );
  await query(
    'INSERT INTO user_profiles(user_id,avatar_url) VALUES ($1,$2) ON CONFLICT DO NOTHING',
    [created.rows[0].id, picture || '']
  );
  return created.rows[0];
}
