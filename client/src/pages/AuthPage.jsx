import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import GoogleButton from '../components/GoogleButton.jsx';

export default function AuthPage({ mode }) {
  const { login, register, loginWithGoogle } = useAuth();
  const isLogin = mode === 'login';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const google = async (credential) => {
    setError('');
    try {
      await loginWithGoogle(credential);
    } catch (err) {
      setError(err.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isLogin) await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-hero">
        <h1><span className="brand-mark">◆</span> TorchLab</h1>
        <p className="lead">Learn. Code. Experiment. Build.</p>
        <ul>
          <li>Bite-sized PyTorch lessons with theory, code and quizzes</li>
          <li>A live Python + PyTorch editor, right in the browser</li>
          <li>XP, streaks and progress that follow you</li>
        </ul>
      </div>
      <form className="card auth-form" onSubmit={submit}>
        <h2>{isLogin ? 'Welcome back' : 'Create your account'}</h2>
        {!isLogin && (
          <label>Name<input value={form.name} onChange={set('name')} required minLength={2} autoComplete="name" /></label>
        )}
        <label>Email<input type="email" value={form.email} onChange={set('email')} required autoComplete="email" /></label>
        <label>
          Password
          <input type="password" value={form.password} onChange={set('password')} required minLength={isLogin ? 1 : 8}
            autoComplete={isLogin ? 'current-password' : 'new-password'} />
          {!isLogin && <small className="muted">At least 8 characters</small>}
          {isLogin && <small><Link to="/forgot-password">Forgot your password?</Link></small>}
        </label>
        {error && <div className="alert err" role="alert">{error}</div>}
        <button className="btn primary block" disabled={busy}>{busy ? 'Please wait…' : isLogin ? 'Log in' : 'Sign up'}</button>
        <GoogleButton onCredential={google} />
        <p className="muted center">
          {isLogin ? (<>New here? <Link to="/register">Create an account</Link></>) : (<>Already have an account? <Link to="/login">Log in</Link></>)}
        </p>
      </form>
    </div>
  );
}
