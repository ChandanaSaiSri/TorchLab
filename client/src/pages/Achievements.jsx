import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Achievements() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/api/achievements').then(setData).catch((e) => setError(e.message));
  }, []);
  if (error) return <div className="alert err">{error}</div>;
  if (!data) return <div className="muted">Loading…</div>;

  const earned = data.badges.filter((b) => b.earned).length;
  const courseCerts = data.certificates.filter((c) => c.kind === 'course');
  const projectCerts = data.certificates.filter((c) => c.kind === 'project');

  return (
    <div>
      <h1>Achievements</h1>
      <p className="muted">Badges are earned automatically as you learn. Each one is worth <strong>25 XP</strong>.</p>
      <div className="stats">
        <div className="card"><div className="muted">Badges</div><div className="stat-n">{earned}<span className="muted"> / {data.badges.length}</span></div></div>
        <div className="card"><div className="muted">Certificates</div><div className="stat-n">{data.certificates.length}</div></div>
        <div className="card"><div className="muted">Best streak</div><div className="stat-n">{data.stats.streak}<span className="muted"> {data.stats.streak === 1 ? "day" : "days"}</span></div></div>
        <div className="card"><div className="muted">Total XP</div><div className="stat-n">{data.stats.xp}</div></div>
      </div>

      <div className="badge-grid">
        {data.badges.map((b) => (
          <div key={b.code} className={`card badge ${b.earned ? 'earned' : 'locked'}`}>
            <div className="badge-icon" aria-hidden="true">{b.icon}</div>
            <div className="badge-body">
              <strong>{b.name}</strong>
              <div className="muted small-note">{b.description}</div>
              {b.earned ? (
                <span className="chip ok">Earned {new Date(b.earnedAt).toLocaleDateString()}</span>
              ) : (
                <>
                  <div className="progress-line"><div style={{ width: `${(b.current / b.target) * 100}%` }} /></div>
                  <div className="muted small-note">{b.current} / {b.target}</div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <h2>Certificates</h2>
      {data.certificates.length === 0 && <p className="muted">Finish a course or a <Link to="/projects">Live Project</Link> to earn your first certificate.</p>}
      {[['Courses', courseCerts], ['Projects', projectCerts]].map(([label, list]) => list.length > 0 && (
        <div key={label}>
          <h3>{label}</h3>
          <ul className="cert-list">
            {list.map((c) => (
              <li key={c.code}>
                <Link to={`/verify/${c.code}`}>{c.title}</Link>
                <span className="muted"> · {c.code} · {new Date(c.issued_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
