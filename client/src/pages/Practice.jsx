import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const DIFFS = ['easy', 'medium', 'hard', 'expert'];
const XP = { easy: 10, medium: 25, hard: 50, expert: 100 };
const STATUS_ICON = { solved: '✅', attempted: '🟡', new: '○' };

export function DiffBadge({ d }) {
  return <span className={`diff ${d}`}>{d}</span>;
}

export default function Practice() {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [diff, setDiff] = useState('all');
  const [cat, setCat] = useState('all');
  const [status, setStatus] = useState('all');

  useEffect(() => {
    Promise.all([api.get('/api/practice/challenges'), api.get('/api/practice/stats')])
      .then(([c, s]) => {
        setData(c);
        setStats(s);
      })
      .catch((e) => setError(e.message));
  }, []);

  const categories = useMemo(() => [...new Set((data?.challenges || []).map((c) => c.category))], [data]);
  const shown = (data?.challenges || []).filter(
    (c) => (diff === 'all' || c.difficulty === diff) && (cat === 'all' || c.category === cat) && (status === 'all' || c.status === status)
  );

  if (error) return <div className="alert err">{error}</div>;
  if (!data) return <div className="muted">Loading…</div>;

  return (
    <div>
      <h1>Practice Arena</h1>
      <p className="muted">
        Coding challenges graded by real test cases, some of them hidden. XP per challenge: Easy {XP.easy} · Medium {XP.medium} · Hard {XP.hard} · Expert {XP.expert}.
        XP is awarded the first time you solve a challenge without opening its solution.
      </p>

      <div className="stats">
        <div className="card">
          <div className="muted">Solved</div>
          <div className="stat-n">{data.summary.solved}<span className="muted"> / {data.summary.total}</span></div>
        </div>
        <div className="card">
          <div className="muted">XP from challenges</div>
          <div className="stat-n">{data.summary.xpEarned}</div>
        </div>
        {DIFFS.map((d) => (
          <div className="card" key={d}>
            <div className="muted"><DiffBadge d={d} /></div>
            <div className="stat-n">{stats?.byDifficulty[d]?.solved ?? 0}<span className="muted"> / {stats?.byDifficulty[d]?.total ?? 0}</span></div>
          </div>
        ))}
      </div>

      <div className="card filters">
        <div className="row-gap wrap">
          <span className="muted">Difficulty</span>
          {['all', ...DIFFS].map((d) => (
            <button key={d} className={`btn small ${diff === d ? 'primary' : ''}`} onClick={() => setDiff(d)}>{d}</button>
          ))}
        </div>
        <div className="row-gap wrap">
          <span className="muted">Status</span>
          {['all', 'new', 'attempted', 'solved'].map((s) => (
            <button key={s} className={`btn small ${status === s ? 'primary' : ''}`} onClick={() => setStatus(s)}>{s}</button>
          ))}
          <span className="muted" style={{ marginLeft: '1rem' }}>Category</span>
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {shown.length === 0 && <p className="muted">No challenges match these filters.</p>}
      <ul className="lesson-list">
        {shown.map((c) => (
          <li key={c.slug}>
            <Link className="card lesson-row" to={`/practice/${c.slug}`}>
              <span className="lesson-icon" title={c.status}>{STATUS_ICON[c.status]}</span>
              <span className="grow">
                <strong>{c.title}</strong>
                <br />
                <small className="muted">{c.category}{c.attempts > 0 && ` · ${c.attempts} attempt${c.attempts === 1 ? '' : 's'}`}</small>
              </span>
              <DiffBadge d={c.difficulty} />
              <span className="chip">{c.xp} XP</span>
            </Link>
          </li>
        ))}
      </ul>

      {stats && (
        <section className="card" style={{ marginTop: '1.5rem' }}>
          <h2 style={{ marginTop: 0 }}>Progress by category</h2>
          {Object.entries(stats.byCategory).map(([name, v]) => (
            <div key={name} className="progress-row">
              <div className="row-between"><span>{name}</span><span className="muted">{v.solved}/{v.total}</span></div>
              <div className="bar"><div style={{ width: `${(v.solved / v.total) * 100}%` }} /></div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
