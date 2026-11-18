import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function SharedProgram() {
  const { token } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.get(`/api/shared/${token}`).then((d) => setP(d.program)).catch((e) => setErr(e.message)); }, [token]);

  const copy = async () => {
    try { await api.post(`/api/compiler/shared/${token}/copy`); nav('/playground'); }
    catch (e) { setErr(e.message); }
  };

  if (err && !p) return <main className="page"><h1>Shared program</h1><div className="alert err">{err}</div><Link to="/">Go to TorchLab</Link></main>;
  if (!p) return <main className="page"><p className="muted">Loading…</p></main>;
  const cells = p.kind === 'notebook' && Array.isArray(p.cells) ? p.cells : null;
  return (
    <main className="page">
      <p className="muted"><Link to="/">TorchLab</Link> · shared by {p.author}</p>
      <h1>{p.title}</h1>
      <p className="muted sm">Read-only view. {p.kind === 'notebook' ? 'Notebook' : 'Script'}.</p>
      {cells ? cells.map((c, i) => <pre key={i} className="out code-view" aria-label={`Cell ${i + 1}`}>{c}</pre>) : <pre className="out code-view">{p.code}</pre>}
      {err && <div className="alert err">{err}</div>}
      {user
        ? <button className="btn primary" onClick={copy}>Make my own copy</button>
        : <p><Link className="btn primary" to="/login">Sign in to make your own copy</Link></p>}
    </main>
  );
}
