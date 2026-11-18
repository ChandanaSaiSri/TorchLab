import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [toasts, setToasts] = useState([]);
  const [resend, setResend] = useState('');

  // After every page change, ask whether a badge was earned since the last look and show it once.
  useEffect(() => {
    let alive = true;
    api.get('/api/achievements/unseen').then((d) => {
      if (!alive || !d.badges.length) return;
      setToasts((t) => [...t, ...d.badges]);
      setTimeout(() => alive && setToasts((t) => t.filter((x) => !d.badges.includes(x))), 7000);
    }).catch(() => {});
    return () => { alive = false; };
  }, [location.pathname]);

  // Learning-time heartbeat: every 30 s, but only while the tab is visible and the learner used the page in the last 2 minutes.
  useEffect(() => {
    let lastInput = Date.now();
    const touch = () => { lastInput = Date.now(); };
    ['pointerdown', 'keydown', 'scroll', 'mousemove'].forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const t = setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - lastInput < 120000) api.post('/api/profile/heartbeat').catch(() => {});
    }, 30000);
    return () => {
      clearInterval(t);
      ['pointerdown', 'keydown', 'scroll', 'mousemove'].forEach((e) => window.removeEventListener(e, touch));
    };
  }, []);

  return (
    <>
      <header className="nav">
        <Link to="/" className="brand">
          <span className="brand-mark">◆</span> TorchLab
        </Link>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/learn">Learn</NavLink>
          <NavLink to="/practice">Practice</NavLink>
          <NavLink to="/assessments">Assessments</NavLink>
          <NavLink to="/projects">Projects</NavLink>
          <NavLink to="/leaderboard">Leaderboard</NavLink>
          <NavLink to="/community">Community</NavLink>
          <NavLink to="/achievements">Achievements</NavLink>
          <NavLink to="/playground">Playground</NavLink>
          <NavLink to="/explore">Explore</NavLink>
          <NavLink to="/profile">Profile</NavLink>
          {(user.role === 'admin' || user.role === 'instructor') && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="nav-user">
          <span className="muted">{user.name}</span>
          <button className="btn ghost" onClick={logout}>Log out</button>
        </div>
      </header>
      {user.emailVerified === false && (
        <div className="verify-banner" role="status">
          <span>Please confirm your email address. We sent a link to <strong>{user.email}</strong>.</span>
          <button className="btn small" onClick={async () => {
            setResend('Sending…');
            try { const r = await api.post('/api/auth/resend-verification'); setResend(r.alreadyVerified ? 'Already confirmed' : r.sent ? 'Sent. Check your inbox.' : 'Email is not set up on this server, so the link was printed in the API window.'); }
            catch (e) { setResend(e.message); }
          }}>Send it again</button>
          {resend && <span className="muted">{resend}</span>}
        </div>
      )}
      <main className="page">{children}</main>
      <div className="toasts" aria-live="polite">
        {toasts.map((b) => (
          <Link to="/achievements" key={b.code} className="toast">
            <span className="toast-icon">{b.icon}</span>
            <span><strong>Badge earned: {b.name}</strong><br /><span className="muted small-note">{b.description} +25 XP</span></span>
          </Link>
        ))}
      </div>
    </>
  );
}
