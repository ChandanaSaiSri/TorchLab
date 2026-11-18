import crypto from 'node:crypto';
import { query } from '../db.js';
import { appUrl, sendMail } from './mailer.js';

export const TTL = { verify: 24 * 60, reset: 60 }; // minutes
const hash = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

/** Make a single-use token; older unused tokens of the same kind for the user stop working. */
export async function createToken(userId, kind) {
  const raw = crypto.randomBytes(32).toString('base64url');
  await query("UPDATE auth_tokens SET used_at=now() WHERE user_id=$1 AND kind=$2 AND used_at IS NULL", [userId, kind]);
  await query(
    `INSERT INTO auth_tokens(user_id,kind,token_hash,expires_at) VALUES ($1,$2,$3, now() + ($4 || ' minutes')::interval)`,
    [userId, kind, hash(raw), String(TTL[kind])]
  );
  return raw;
}

/** Atomically use a token. Returns the user id, or null if it is unknown, expired or already used. */
export async function consumeToken(raw, kind) {
  if (typeof raw !== 'string' || raw.length < 20 || raw.length > 200) return null;
  const r = await query(
    `UPDATE auth_tokens SET used_at=now() WHERE token_hash=$1 AND kind=$2 AND used_at IS NULL AND expires_at > now() RETURNING user_id`,
    [hash(raw), kind]
  );
  return r.rows[0]?.user_id ?? null;
}

export async function sendVerificationEmail(user) {
  const token = await createToken(user.id, 'verify');
  return sendMail({
    to: user.email,
    subject: 'Confirm your TorchLab email',
    text: `Hi ${user.name},\n\nConfirm your email address to finish setting up TorchLab:\n\n${appUrl()}/verify-email?token=${token}\n\nThe link works for 24 hours. If you did not sign up, ignore this message.\n`,
  });
}

export async function sendResetEmail(user) {
  const token = await createToken(user.id, 'reset');
  return sendMail({
    to: user.email,
    subject: 'Reset your TorchLab password',
    text: `Hi ${user.name},\n\nSomeone asked to reset the password for this account. To choose a new one, open:\n\n${appUrl()}/reset-password?token=${token}\n\nThe link works for 1 hour and only once. If this was not you, ignore this message; your password stays the same.\n`,
  });
}

export async function purgeTokens() {
  await query("DELETE FROM auth_tokens WHERE (used_at IS NOT NULL AND used_at < now() - interval '7 days') OR expires_at < now() - interval '7 days'");
}
