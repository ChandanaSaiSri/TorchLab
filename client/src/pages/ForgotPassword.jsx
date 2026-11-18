import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { const r = await api.post('/api/auth/forgot-password', { email }); setDone(r.message); }
    catch (er) { setError(er.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="auth single">
      <form className="card auth-form" onSubmit={submit}>
        <h2>Forgot your password?</h2>
        {done ? (
          <>
            <div className="alert ok" role="status">{done}</div>
            <p className="muted">Nothing arrived? Check your spam folder, or try again in a few minutes. If you run TorchLab on your own computer without email set up, the link is printed in the API window.</p>
          </>
        ) : (
          <>
            <p className="muted">Enter the email you signed up with and we will send you a link to choose a new password.</p>
            <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus /></label>
            {error && <div className="alert err" role="alert">{error}</div>}
            <button className="btn primary block" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
          </>
        )}
        <p className="muted center"><Link to="/login">Back to log in</Link></p>
      </form>
    </div>
  );
}
