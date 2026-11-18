import jwt from 'jsonwebtoken';

const isProd = process.env.NODE_ENV === 'production';
const SECRET = process.env.JWT_SECRET || 'dev-only-secret';
if (isProd && SECRET === 'dev-only-secret') {
  throw new Error('JWT_SECRET must be set in production');
}

export const COOKIE = 'torchlab_token';

export function setSession(res, user) {
  const token = jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '7d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 7 * 24 * 3600 * 1000,
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE);
}

export function requireAuth(req, res, next) {
  try {
    req.user = jwt.verify(req.cookies?.[COOKIE], SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Not authenticated' });
  }
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'Forbidden' });
