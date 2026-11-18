import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { KIND_LABEL } from './Assessments.jsx';

export default function AssessmentDetail() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    api.get(`/api/assessments/${slug}`).then(setData).catch((e) => setError(e.message));
  }, [slug]);

  if (error && !data) return <div className="alert err">{error}</div>;
  if (!data) return <div className="muted">Loading…</div>;
  const { assessment: a, attempts, attemptsLeft } = data;
  const open = attempts.find((t) => t.status !== 'submitted');

  const start = async () => {
    setStarting(true);
    setError('');
    try {
      const p = await api.post(`/api/assessments/${slug}/start`);
      nav(`/assessments/attempt/${p.attempt.id}`);
    } catch (e) {
      setError(e.message);
      setStarting(false);
    }
  };

  return (
    <div>
      <p className="muted"><Link to="/assessments">← Assessments</Link></p>
      <h1>{a.title}</h1>
      <div className="row-gap"><span className="chip">{KIND_LABEL[a.kind]}</span><span className="chip">+{a.xp} XP on passing</span></div>
      <p>{a.description}</p>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>Rules</h3>
        <ul className="rules">
          <li><strong>Time limit:</strong> {a.timeLimitMin} minutes. The clock runs on the server, so closing the page does not pause it. Anything you saved is graded when time runs out.</li>
          <li><strong>Questions:</strong> {a.sections.map((s) => `${s.count} ${s.name}`).join(', ')}, drawn at random from a larger pool, with shuffled answer options.</li>
          <li><strong>Passing score:</strong> {a.passPercent}%.</li>
          <li><strong>Scoring:</strong> theory 20% · coding 30% · practical 50% (for the sections included). Multiple-select questions give partial credit. Code is run against hidden tests and earns partial credit for each test passed.</li>
          {a.negativeMarking > 0 && <li><strong>Negative marking:</strong> a wrong single-choice answer costs {a.negativeMarking} of its points. Unanswered questions cost nothing, and a section never goes below zero.</li>}
          <li><strong>Attempts:</strong> {a.maxAttempts > 0 ? `${a.maxAttempts} in total (${attemptsLeft} left). Your best score counts.` : 'unlimited. Your best score counts.'}</li>
        </ul>
      </section>

      {error && <div className="alert err">{error}</div>}
      <div className="row-gap" style={{ margin: '1rem 0' }}>
        {open ? (
          <Link className="btn primary" to={`/assessments/attempt/${open.id}`}>Resume your attempt</Link>
        ) : attemptsLeft === 0 ? (
          <span className="alert err">You have used all attempts for this assessment.</span>
        ) : (
          <button className="btn primary" onClick={start} disabled={starting}>{starting ? 'Starting…' : attempts.length ? 'Start a new attempt' : 'Start assessment'}</button>
        )}
      </div>

      {attempts.length > 0 && (
        <>
          <h2>Your attempts</h2>
          <ul className="lesson-list">
            {attempts.map((t, i) => (
              <li key={t.id}>
                <Link className="card lesson-row" to={`/assessments/attempt/${t.id}`}>
                  <span className="grow">
                    <strong>Attempt {attempts.length - i}</strong>
                    <br />
                    <small className="muted">{new Date(t.started_at).toLocaleString()}</small>
                  </span>
                  {t.status === 'submitted' ? (
                    <>
                      <span className={`status ${t.passed ? 'success' : 'error'}`}>{t.passed ? 'passed' : 'not passed'}</span>
                      <strong>{t.score}%</strong>
                    </>
                  ) : (
                    <span className="chip warn">in progress</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
