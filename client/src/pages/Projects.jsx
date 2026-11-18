import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const LEVEL_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

export function LevelBadge({ level }) {
  return <span className={`diff ${level === 'beginner' ? 'easy' : level === 'intermediate' ? 'medium' : 'hard'}`}>{LEVEL_LABEL[level] || level}</span>;
}

export default function Projects() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/api/projects').then(setData).catch((e) => setError(e.message));
  }, []);
  if (error) return <div className="alert err">{error}</div>;
  if (!data) return <div className="muted">Loading…</div>;

  return (
    <div>
      <h1>Live Projects</h1>
      <p className="muted">
        Build real models end to end. Each project is split into milestones that are checked by automated tests; finish them all to earn
        <strong> 250 XP</strong> and a verifiable certificate that goes into your <Link to="/portfolio">portfolio</Link>.
      </p>
      <div className="stats">
        <div className="card"><div className="muted">Completed</div><div className="stat-n">{data.summary.completed}<span className="muted"> / {data.summary.total}</span></div></div>
        <div className="card"><div className="muted">In progress</div><div className="stat-n">{data.summary.active}</div></div>
      </div>
      <div className="project-grid">
        {data.projects.map((p) => (
          <Link key={p.slug} to={`/projects/${p.slug}`} className="card project-card">
            <div className="row-gap">
              <LevelBadge level={p.level} />
              <span className="chip">~{p.hours} h</span>
              <span className="chip">{p.xp} XP</span>
              {p.status === 'completed' && <span className="chip ok">Completed</span>}
            </div>
            <h3>{p.title}</h3>
            <p className="muted">{p.summary}</p>
            <div className="row-gap">{p.skills.map((s) => <span className="chip soft" key={s}>{s}</span>)}</div>
            <div className="progress-line" aria-label={`${p.passed} of ${p.total} milestones`}>
              <div style={{ width: `${(p.passed / p.total) * 100}%` }} />
            </div>
            <div className="muted small-note">
              {p.status === 'new' ? `${p.total} milestones` : `${p.passed} / ${p.total} milestones`}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
