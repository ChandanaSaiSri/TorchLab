import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { OAuth2Client } from 'google-auth-library';
import { setSession, clearSession, requireAuth } from '../auth.js';
import { findOrCreateGoogleUser } from '../services/users.js';
import { consumeToken, sendResetEmail, sendVerificationEmail } from '../services/authTokens.js';
import { mailEnabled } from '../services/mailer.js';

const router = Router();
const googleClient = new OAuth2Client();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Please wait a few minutes and try again.' } });

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(100),
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, emailVerified: u.email_verified !== false });

// Per-email and per-user throttles so the mail endpoints cannot be used to spam someone.
const hourly = (limit, keyOf) => rateLimit({
  windowMs: 60 * 60 * 1000, limit, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => keyOf(req),
  message: { error: 'Too many requests. Please try again in an hour.' },
});
const forgotLimiter = hourly(5, (req) => `f:${String(req.body?.email || '').toLowerCase().slice(0, 200)}`);
const resendLimiter = hourly(5, (req) => `v:${req.user.id}`);
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(100);

router.post('/register', limiter, async (req, res) => {
  const p = registerSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  const { name, email, password } = p.data;
  const hash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await query(
      'INSERT INTO users(name,email,password_hash) VALUES ($1,$2,$3) RETURNING id,name,email,role,email_verified',
      [name, email, hash]
    );
    await query('INSERT INTO user_profiles(user_id) VALUES ($1)', [rows[0].id]);
    setSession(res, rows[0]);
    sendVerificationEmail(rows[0]).catch((e) => console.error('verification email failed:', e.message));
    res.status(201).json({ user: publicUser(rows[0]) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'An account with this email already exists' });
    throw e;
  }
});

router.post('/login', limiter, async (req, res) => {
  const p = loginSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Enter a valid email and password' });
  const { rows } = await query('SELECT * FROM users WHERE email=$1', [p.data.email]);
  const u = rows[0];
  if (u && !u.password_hash) {
    return res.status(401).json({ error: 'This account uses Google sign-in. Use the "Continue with Google" button.' });
  }
  const ok = u && (await bcrypt.compare(p.data.password, u.password_hash));
  if (!ok) return res.status(401).json({ error: 'Incorrect email or password' });
  setSession(res, u);
  res.json({ user: publicUser(u) });
});

// Public: lets the browser know whether (and with which client id) to show Google sign-in.
router.get('/config', (_req, res) => res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null }));

router.post('/google', limiter, async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(503).json({ error: 'Google sign-in is not configured on this server' });
  const p = z.object({ credential: z.string().min(20).max(5000) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Missing Google credential' });

  let payload;
  try {
    // Verifies signature, expiry, issuer and that the token was minted for OUR client id.
    const ticket = await googleClient.verifyIdToken({ idToken: p.data.credential, audience: clientId });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: 'Google sign-in could not be verified' });
  }
  if (!payload?.sub || !payload.email || !payload.email_verified) {
    return res.status(401).json({ error: 'Your Google email address is not verified' });
  }
  const user = await findOrCreateGoogleUser(payload);
  setSession(res, user);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT u.id,u.name,u.email,u.role,u.created_at,u.email_verified AS "emailVerified",(u.password_hash IS NOT NULL) AS "hasPassword",p.bio,p.level
     FROM users u LEFT JOIN user_profiles p ON p.user_id=u.id WHERE u.id=$1`,
    [req.user.id]
  );
  if (!rows[0]) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ user: rows[0] });
});

const profileSchema = z.object({ name: z.string().trim().min(2).max(80), bio: z.string().max(500) });
router.put('/me', requireAuth, async (req, res) => {
  const p = profileSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  await query('UPDATE users SET name=$1 WHERE id=$2', [p.data.name, req.user.id]);
  await query(
    `INSERT INTO user_profiles(user_id,bio) VALUES ($1,$2)
     ON CONFLICT (user_id) DO UPDATE SET bio=EXCLUDED.bio`,
    [req.user.id, p.data.bio]
  );
  res.json({ ok: true });
});

// ------------------------------------------------------------------ email verification
router.post('/verify-email', limiter, async (req, res) => {
  const userId = await consumeToken(req.body?.token, 'verify');
  if (!userId) return res.status(400).json({ error: 'This link is invalid or has expired. Request a new one from your account.' });
  await query('UPDATE users SET email_verified=TRUE WHERE id=$1', [userId]);
  res.json({ ok: true });
});

router.post('/resend-verification', requireAuth, resendLimiter, async (req, res) => {
  const { rows } = await query('SELECT id,name,email,email_verified FROM users WHERE id=$1', [req.user.id]);
  if (!rows[0]) return res.status(401).json({ error: 'Not authenticated' });
  if (rows[0].email_verified) return res.json({ ok: true, alreadyVerified: true });
  const sent = await sendVerificationEmail(rows[0]);
  res.json({ ok: true, sent, mailConfigured: mailEnabled });
});

// ------------------------------------------------------------------ password reset
// Always answers the same way, so the form cannot be used to find out which emails have accounts.
router.post('/forgot-password', limiter, forgotLimiter, async (req, res) => {
  const p = z.object({ email: z.string().trim().toLowerCase().email() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Enter a valid email address' });
  const { rows } = await query('SELECT id,name,email FROM users WHERE email=$1', [p.data.email]);
  if (rows[0]) await sendResetEmail(rows[0]).catch((e) => console.error('reset email failed:', e.message));
  res.json({ ok: true, message: 'If an account exists for that email, we have sent a reset link. It works for one hour.' });
});

router.post('/reset-password', limiter, async (req, res) => {
  const p = z.object({ token: z.string().min(20).max(200), password: passwordSchema }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  const userId = await consumeToken(p.data.token, 'reset');
  if (!userId) return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one.' });
  const hash = await bcrypt.hash(p.data.password, 12);
  // Opening the emailed link proves the person controls the mailbox, so the address counts as verified.
  await query('UPDATE users SET password_hash=$1, email_verified=TRUE WHERE id=$2', [hash, userId]);
  await query("UPDATE auth_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL", [userId]);
  res.json({ ok: true });
});

router.post('/change-password', requireAuth, limiter, async (req, res) => {
  const p = z.object({ current: z.string().max(100).optional(), password: passwordSchema }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  const { rows } = await query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
  if (!rows[0]) return res.status(401).json({ error: 'Not authenticated' });
  // Google-only accounts have no password yet, so they can set one without a "current" value.
  if (rows[0].password_hash && !(p.data.current && (await bcrypt.compare(p.data.current, rows[0].password_hash)))) {
    return res.status(400).json({ error: 'Your current password is not correct' });
  }
  await query('UPDATE users SET password_hash=$1 WHERE id=$2', [await bcrypt.hash(p.data.password, 12), req.user.id]);
  res.json({ ok: true });
});

export default router;
