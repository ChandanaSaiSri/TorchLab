import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { user, refresh } = useAuth();
  const [state, setState] = useState(token ? 'working' : 'missing');
  const [error, setError] = useState('');
  const started = useRef(false); // the link works once, and React dev mode runs effects twice

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    api.post('/api/auth/verify-email', { token })
      .then(() => { setState('ok'); refresh(); })
      .catch((e) => { setError(e.message); setState('error'); });
  }, [token, refresh]);

  return (
    <div className="auth single">
      <div className="card auth-form">
        <h2>Email confirmation</h2>
        {state === 'working' && <p className="muted">Confirming…</p>}
        {state === 'ok' && <div className="alert ok" role="status">Your email address is confirmed. Thank you!</div>}
        {state === 'error' && <div className="alert err" role="alert">{error}</div>}
        {state === 'missing' && <div className="alert err">This page needs the link from your email.</div>}
        <Link className="btn primary block" to={user ? '/' : '/login'}>{user ? 'Go to the dashboard' : 'Log in'}</Link>
      </div>
    </div>
  );
}
