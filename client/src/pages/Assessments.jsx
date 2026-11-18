import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export const KIND_LABEL = { conceptual: 'Conceptual', coding: 'Coding', practical: 'Practical', comprehensive: 'Comprehensive' };

export default function Assessments() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/api/assessments').then((d) => setItems(d.assessments)).catch((e) => setError(e.message));
  }, []);
  if (error) return <div className="alert err">{error}</div>;
  if (!items) return <div className="muted">Loading…</div>;

  return (
    <div>
      <h1>Assessments</h1>
      <p className="muted">
        Timed tests that check what you really know. Every attempt draws a different random set of questions, so a retake is never the same paper.
        Your assessment <strong>score</strong> is separate from your <strong>XP</strong>: XP is a bonus for passing, the score is the result.
        The overall score weights theory 20%, coding 30% and practical 50% (only for the sections a test contains).
      </p>
      <div className="grid2">
        {items.map((a) => {
          const left = a.maxAttempts > 0 ? a.maxAttempts - a.attemptsUsed : null;
          return (
            <Link key={a.slug} to={`/assessments/${a.slug}`} className="card course-card">
              <div className="row-between">
                <span className="chip">{KIND_LABEL[a.kind]}</span>
                {a.passed ? <span className="chip ok">Passed</span> : a.openAttemptId ? <span className="chip warn">In progress</span> : null}
              </div>
              <h3>{a.title}</h3>
              <p className="muted">{a.description}</p>
              <div className="meta">
                <span>⏱ {a.timeLimitMin} min</span>
                <span>Pass at {a.passPercent}%</span>
                <span>{a.sections.reduce((n, s) => n + s.count, 0)} questions</span>
                <span>+{a.xp} XP</span>
              </div>
              <div className="row-between" style={{ marginTop: '.6rem' }}>
                <span className="muted">
                  {left === null ? 'Unlimited attempts' : `${left} of ${a.maxAttempts} attempts left`}
                </span>
                <strong>{a.bestScore !== null ? `Best ${a.bestScore}%` : 'Not taken yet'}</strong>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
