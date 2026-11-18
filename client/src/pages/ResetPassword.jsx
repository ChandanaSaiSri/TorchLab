import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setError('');
    if (pw !== pw2) return setError('The two passwords do not match');
    setBusy(true);
    try { await api.post('/api/auth/reset-password', { token, password: pw }); setDone(true); }
    catch (er) { setError(er.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="auth single">
      <form className="card auth-form" onSubmit={submit}>
        <h2>Choose a new password</h2>
        {!token ? (
          <div className="alert err">This page needs the link from your email. <Link to="/forgot-password">Request a new link</Link>.</div>
        ) : done ? (
          <>
            <div className="alert ok" role="status">Your password was changed.</div>
            <Link className="btn primary block" to="/login">Log in</Link>
          </>
        ) : (
          <>
            <label>New password<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} autoComplete="new-password" autoFocus /><small className="muted">At least 8 characters</small></label>
            <label>Repeat it<input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required minLength={8} autoComplete="new-password" /></label>
            {error && <div className="alert err" role="alert">{error} {/expired|invalid/.test(error) && <Link to="/forgot-password">Request a new link</Link>}</div>}
            <button className="btn primary block" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
          </>
        )}
      </form>
    </div>
  );
}
