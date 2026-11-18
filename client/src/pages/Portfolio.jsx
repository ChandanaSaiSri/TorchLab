import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { api } from '../api.js';
import { LevelBadge } from './Projects.jsx';

/** /portfolio = your own (with the sharing switch); /portfolio/u/:id = the public view of someone else's. */
export default function Portfolio() {
  const { id } = useParams();
  const own = !id;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get(own ? '/api/portfolio/me' : `/api/portfolio/u/${id}`).then(setData).catch((e) => setError(e.status === 404 ? 'This portfolio is private or does not exist.' : e.message));
  }, [id, own]);

  if (error) return <div className="alert err" style={{ margin: '2rem auto', maxWidth: 560 }}>{error}</div>;
  if (!data) return <div className="muted">Loading…</div>;

  const link = `${window.location.origin}/portfolio/u/${data.user.id}`;
  const toggle = async () => {
    const r = await api.put('/api/portfolio/me', { public: !data.public });
    setData({ ...data, public: r.public });
  };

  return (
    <div className={own ? '' : 'cert-page'}>
      {!own && <header className="cert-top"><Link to="/" className="brand"><span className="brand-mark">◆</span> TorchLab</Link></header>}
      <h1>{own ? 'My portfolio' : `${data.user.name}'s portfolio`}</h1>
      {own && (
        <div className="card">
          <label className="row-gap switch"><input type="checkbox" checked={data.public} onChange={toggle} /> <strong>Make my portfolio public</strong></label>
          <p className="muted small-note">Anyone with the link can see your completed projects, certificates and the code you wrote for them. Nothing else is shown.</p>
          {data.public && (
            <div className="row-gap">
              <code>{link}</code>
              <button className="btn small" onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copied' : 'Copy link'}</button>
            </div>
          )}
        </div>
      )}
      {data.skills.length > 0 && <div className="row-gap" style={{ margin: '1rem 0' }}>{data.skills.map((s) => <span className="chip soft" key={s}>{s}</span>)}</div>}

      <h2>Projects</h2>
      {data.projects.length === 0 && <p className="muted">No completed projects yet. {own && <Link to="/projects">Start one</Link>}</p>}
      {data.projects.map((p) => (
        <div className="card" key={p.slug} style={{ marginBottom: '1rem' }}>
          <div className="row-gap"><LevelBadge level={p.level} /><span className="muted small-note">Completed {new Date(p.completed_at).toLocaleDateString()}</span></div>
          <h3>{p.title}</h3>
          <div className="prose"><ReactMarkdown>{p.summary}</ReactMarkdown></div>
          <div className="row-gap">{p.skills.map((s) => <span className="chip soft" key={s}>{s}</span>)}</div>
          <p>{p.certificate && <Link to={`/verify/${p.certificate}`}>Certificate {p.certificate}</Link>}</p>
          <details><summary>View my code</summary><pre className="solution"><code>{p.code}</code></pre></details>
        </div>
      ))}

      <h2>Certificates</h2>
      {data.certificates.length === 0 ? <p className="muted">None yet.</p> : (
        <ul>{data.certificates.map((c) => <li key={c.code}><Link to={`/verify/${c.code}`}>{c.title}</Link> <span className="muted">· {c.code} · {new Date(c.issued_at).toLocaleDateString()}</span></li>)}</ul>
      )}
    </div>
  );
}
