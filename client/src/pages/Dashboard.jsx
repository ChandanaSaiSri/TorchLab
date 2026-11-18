import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const REC_LABEL = { lesson: 'Lesson', project: 'Project', practice: 'Practice', assessment: 'Assessment' };

export function LevelBar({ level }) {
  return (
    <div className="level-bar">
      <span className="chip ok">Level {level.index} · {level.name}</span>
      <div className="bar"><div style={{ width: `${Math.round(level.progress * 100)}%` }} /></div>
      <span className="muted small-note">{level.nextName ? `${level.nextAt - level.xp} XP to ${level.nextName}` : 'Top level reached'}</span>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/dashboard').then(setD).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="alert err">{error}</div>;
  if (!d) return <div className="muted">Loading…</div>;

  return (
    <>
      <h1>Hi {user.name.split(' ')[0]} 👋</h1>
      <LevelBar level={d.level} />

      <div className="stats">
        <div className="card stat"><div className="stat-n">{d.xp}</div><div className="muted">Total XP</div></div>
        <div className="card stat">
          <div className="stat-n">{d.streak.current} 🔥</div>
          <div className="muted">Day streak{d.streak.current > 0 && !d.streak.activeToday ? ' · learn today to keep it' : ''}</div>
        </div>
        <div className="card stat">
          <div className="stat-n">{pct(d.overall.completed, d.overall.total)}%</div>
          <div className="muted">{d.overall.completed}/{d.overall.total} lessons done</div>
        </div>
      </div>

      {d.recommendations.length > 0 && (
        <section className="card recs">
          <h3>Recommended for you</h3>
          <div className="rec-grid">
            {d.recommendations.map((r) => (
              <Link key={r.href} to={r.href} className="rec">
                <span className="chip soft">{REC_LABEL[r.type] || r.type}</span>
                <strong>{r.title}</strong>
                <span className="muted small-note">{r.reason}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid2">
        <section className="card">
          <h3>Continue learning</h3>
          {d.continue ? (
            <>
              <p><strong>{d.continue.title}</strong><br /><span className="muted">{d.continue.course_title}</span></p>
              <Link className="btn primary" to={`/learn/${d.continue.course_slug}/${d.continue.slug}`}>Resume lesson →</Link>
            </>
          ) : (
            <p className="muted">You have completed every available lesson. More are on the way!</p>
          )}
        </section>

        <section className="card">
          <h3>Course progress</h3>
          {d.courses.map((c) => (
            <Link key={c.slug} to={`/learn/${c.slug}`} className="progress-row">
              <div className="row-between"><span>{c.title}</span><span className="muted">{c.completed}/{c.total}</span></div>
              <div className="bar"><div style={{ width: `${pct(c.completed, c.total)}%` }} /></div>
            </Link>
          ))}
        </section>

        <section className="card">
          <h3>Assessment scores</h3>
          {d.assessments.length === 0 && <p className="muted">No assessments taken yet. <Link to="/assessments">Browse assessments</Link>.</p>}
          {d.assessments.map((a) => (
            <Link key={a.slug} to={`/assessments/${a.slug}`} className="progress-row">
              <div className="row-between">
                <span>{a.title}</span>
                <span className={a.passed ? 'chip ok' : 'chip'}>{Math.round(a.best)}%{a.passed ? ' · passed' : ` · need ${Math.round(a.pass)}%`}</span>
              </div>
              <div className="bar"><div style={{ width: `${Math.min(100, a.best)}%` }} /></div>
            </Link>
          ))}
        </section>

        <section className="card">
          <h3>Active projects</h3>
          {d.projects.length === 0 && <p className="muted">No project in progress. <Link to="/projects">Start one</Link>.</p>}
          {d.projects.map((p) => (
            <Link key={p.slug} to={`/projects/${p.slug}`} className="progress-row">
              <div className="row-between"><span>{p.title}</span><span className="muted">{p.passed}/{p.total} milestones</span></div>
              <div className="bar"><div style={{ width: `${pct(p.passed, p.total)}%` }} /></div>
            </Link>
          ))}
        </section>

        <section className="card">
          <h3>Recent lessons</h3>
          {d.recentLessons.length === 0 && <p className="muted">Nothing completed yet. Your first lesson takes about 10 minutes.</p>}
          <ul className="plain">
            {d.recentLessons.map((l) => (
              <li key={l.course_slug + l.slug}><Link to={`/learn/${l.course_slug}/${l.slug}`}>{l.title}</Link> <span className="muted">· quiz {l.quiz_score}</span></li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h3>Recent code runs</h3>
          {d.recentRuns.length === 0 && <p className="muted">No runs yet. <Link to="/playground">Open the playground</Link>.</p>}
          <ul className="plain">
            {d.recentRuns.map((r) => (
              <li key={r.id} className="run-li">
                <span className={`dot ${r.status}`} />
                <code>{r.preview.replace(/\s+/g, ' ')}</code>
                <span className="muted">{(r.runtime_ms / 1000).toFixed(1)}s</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
