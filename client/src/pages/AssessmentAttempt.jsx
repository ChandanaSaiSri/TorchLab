import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import Editor from '@monaco-editor/react';
import { api } from '../api.js';

const SECTION_TITLE = { theory: 'Theory', coding: 'Coding', practical: 'Practical' };
const n2 = (x) => Math.round(x * 100) / 100;
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function AssessmentAttempt() {
  const { id } = useParams();
  const [state, setState] = useState(null); // the payload from the API
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    return api.get(`/api/assessments/attempts/${id}`).then(setState).catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => {
    setState(null);
    load();
    window.scrollTo(0, 0);
  }, [load]);

  if (error && !state) return <div className="alert err">{error} <button className="btn small" onClick={load}>Retry</button></div>;
  if (!state) return <div className="muted">Loading…</div>;
  if (state.state === 'submitted') return <Result data={state} />;
  return <Take data={state} onDone={setState} />;
}

/* ------------------------------------------------------------------ taking the test */
function Take({ data, onDone }) {
  const { attempt, assessment, questions } = data;
  const [answers, setAnswers] = useState(data.answers || {});
  const [endsAt] = useState(() => Date.now() + attempt.secondsLeft * 1000);
  const [left, setLeft] = useState(attempt.secondsLeft);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [saveState, setSaveState] = useState('saved');
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const submittingRef = useRef(false);
  const dirty = useRef(false);

  const submit = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setNotice('');
    try {
      const r = await api.post(`/api/assessments/attempts/${attempt.id}/submit`, { answers: answersRef.current });
      onDone(r);
      window.scrollTo(0, 0);
    } catch (e) {
      setNotice(e.message);
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [attempt.id, onDone]);

  // countdown, auto-submit at zero
  useEffect(() => {
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        clearInterval(t);
        submit();
      }
    }, 500);
    return () => clearInterval(t);
  }, [endsAt, submit]);

  // autosave (debounced) so a refresh or crash loses nothing
  useEffect(() => {
    if (!dirty.current) return undefined;
    setSaveState('saving');
    const t = setTimeout(() => {
      api
        .put(`/api/assessments/attempts/${attempt.id}/answers`, { answers })
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    }, 1200);
    return () => clearTimeout(t);
  }, [answers, attempt.id]);

  const set = (qid, value) => {
    dirty.current = true;
    setAnswers((a) => {
      const next = { ...a };
      if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) delete next[qid];
      else next[qid] = value;
      return next;
    });
  };

  const answered = questions.filter((q) => answers[q.qid] !== undefined && answers[q.qid] !== '').length;
  const confirmSubmit = () => {
    const missing = questions.length - answered;
    if (missing > 0 && !window.confirm(`${missing} question${missing === 1 ? ' is' : 's are'} unanswered. Submit anyway?`)) return;
    submit();
  };

  const bySection = ['theory', 'coding', 'practical']
    .map((s) => [s, questions.filter((q) => q.section === s)])
    .filter(([, qs]) => qs.length);
  let number = 0;

  return (
    <div className="take">
      <div className="take-bar">
        <div>
          <strong>{assessment.title}</strong>
          <div className="muted small-note">{answered} of {questions.length} answered · {saveState === 'saving' ? 'saving…' : saveState === 'error' ? 'could not save, will retry on next change' : 'saved'}</div>
        </div>
        <div className={`timer ${left <= 60 ? 'danger' : left <= 300 ? 'warn' : ''}`} aria-live="off" title="Time left">{fmt(left)}</div>
        <button className="btn primary" onClick={confirmSubmit} disabled={submitting}>{submitting ? 'Grading…' : 'Submit'}</button>
      </div>
      {submitting && <div className="alert ok">Grading your answers. Code is run against the tests, which can take up to a minute…</div>}
      {notice && <div className="alert err">{notice}</div>}
      {assessment.negativeMarking > 0 && <div className="alert warn">Negative marking: a wrong single-choice answer costs {assessment.negativeMarking} of its points. Unanswered questions cost nothing.</div>}

      {bySection.map(([section, qs]) => (
        <section key={section}>
          <h2>{SECTION_TITLE[section]}</h2>
          {qs.map((q) => {
            number += 1;
            return <Question key={q.qid} n={number} q={q} value={answers[q.qid]} onChange={(v) => set(q.qid, v)} />;
          })}
        </section>
      ))}

      <div className="row-between" style={{ marginTop: '1.5rem' }}>
        <span className="muted">{answered} of {questions.length} answered</span>
        <button className="btn primary" onClick={confirmSubmit} disabled={submitting}>{submitting ? 'Grading…' : 'Submit assessment'}</button>
      </div>
    </div>
  );
}

function Question({ n, q, value, onChange }) {
  return (
    <div className="card question">
      <div className="row-between">
        <strong>Question {n}</strong>
        <span className="muted small-note">{q.type === 'multi' ? 'select all that apply · ' : ''}{q.points} point{q.points === 1 ? '' : 's'}</span>
      </div>
      {q.type === 'code' ? <CodeQuestion q={q} value={value} onChange={onChange} /> : <Choice q={q} value={value} onChange={onChange} />}
    </div>
  );
}

function Choice({ q, value, onChange }) {
  const multi = q.type === 'multi';
  const selected = multi ? value || [] : value;
  return (
    <>
      <div className="prose"><ReactMarkdown>{q.prompt}</ReactMarkdown></div>
      {q.options.map((o, i) => {
        const on = multi ? selected.includes(i) : selected === i;
        return (
          <label key={i} className={`opt ${on ? 'picked' : ''}`}>
            <input
              type={multi ? 'checkbox' : 'radio'}
              name={q.qid}
              checked={on}
              onChange={() => (multi ? onChange(on ? selected.filter((x) => x !== i) : [...selected, i]) : onChange(i))}
            />
            <span><ReactMarkdown components={{ p: 'span' }}>{o}</ReactMarkdown></span>
          </label>
        );
      })}
      {!multi && value !== undefined && <button className="link-btn small-note" onClick={() => onChange(null)}>Clear my answer</button>}
    </>
  );
}

function CodeQuestion({ q, value, onChange }) {
  const code = value ?? q.starter;
  const [out, setOut] = useState(null);
  const [running, setRunning] = useState(false);
  const run = async () => {
    setRunning(true);
    try {
      setOut(await api.post('/api/compiler/execute', { code }));
    } catch (e) {
      setOut({ status: 'error', stdout: '', stderr: e.message });
    } finally {
      setRunning(false);
    }
  };
  return (
    <>
      <h3 style={{ margin: '.4rem 0' }}>{q.title}</h3>
      <div className="prose"><ReactMarkdown>{q.prompt}</ReactMarkdown></div>
      <div className="runner">
        <div className="runner-bar">
          <span className="chip">Python 3 · CPU</span>
          <div className="spacer" />
          <button className="btn ghost" onClick={() => onChange(q.starter)}>Reset</button>
          <button className="btn" onClick={run} disabled={running}>{running ? 'Running…' : '▶ Run'}</button>
        </div>
        <Editor
          height={300}
          language="python"
          theme="vs-dark"
          value={code}
          onChange={(v) => onChange(v ?? '')}
          options={{ minimap: { enabled: false }, fontSize: 14, fontFamily: 'JetBrains Mono, monospace', scrollBeyondLastLine: false, tabSize: 4 }}
        />
        {out && (
          <div className="console">
            <div className="console-head">Run output <span className={`status ${out.status}`}>{out.status}</span></div>
            {out.stdout && <pre className="out">{out.stdout}</pre>}
            {out.stderr && <pre className="out err">{out.stderr}</pre>}
            {!out.stdout && !out.stderr && <pre className="out muted">(no output)</pre>}
          </div>
        )}
      </div>
      <p className="muted small-note">Run only executes your code. It is graded against hidden tests when you submit.</p>
    </>
  );
}

/* ------------------------------------------------------------------ results */
function Result({ data }) {
  const { assessment, result, attempt } = data;
  const sections = Object.entries(result.sections);
  return (
    <div>
      <p className="muted"><Link to={`/assessments/${assessment.slug}`}>← {assessment.title}</Link></p>
      <h1>Results</h1>
      <div className={`card score ${result.passed ? 'pass' : 'fail'}`}>
        <div className="score-n">{result.percent}%</div>
        <div>
          <div className="score-label">{result.passed ? 'Passed 🎉' : 'Not passed yet'}</div>
          <div className="muted">Pass mark {result.passPercent}%{result.timedOut ? ' · time ran out, saved answers were graded' : ''}</div>
          {result.xpAwarded ? <div><strong>+{result.xpAwarded} XP earned</strong></div> : null}
          <div className="muted small-note">Submitted {new Date(attempt.submittedAt).toLocaleString()}</div>
        </div>
      </div>

      <h2>Section breakdown</h2>
      <div className="card">
        {sections.map(([name, s]) => (
          <div key={name} className="progress-row">
            <div className="row-between">
              <span>{SECTION_TITLE[name]} <span className="muted">(weight {s.weight}%)</span></span>
              <span><strong>{s.percent}%</strong> <span className="muted">({n2(s.earned)} / {n2(s.possible)} points)</span></span>
            </div>
            <div className="bar"><div style={{ width: `${s.percent}%` }} /></div>
          </div>
        ))}
        <p className="muted small-note">Overall score = weighted average of the sections above (theory 20, coding 30, practical 50, using only the sections in this test).</p>
      </div>

      <h2>Review</h2>
      {result.questions.map((q, i) => (
        <div key={q.qid} className={`card review ${q.status}`}>
          <div className="row-between">
            <strong>{i + 1}. {SECTION_TITLE[q.section]}</strong>
            <span className={`status ${q.status === 'correct' ? 'success' : q.status === 'unanswered' ? '' : 'error'}`}>
              {q.status} · {n2(q.earned)} / {n2(q.possible)}
            </span>
          </div>
          <div className="prose"><ReactMarkdown>{q.prompt}</ReactMarkdown></div>
          {q.review && (
            <>
              <ul className="review-opts">
                {q.review.options.map((o, j) => (
                  <li key={j} className={`${o.correct ? 'right' : o.selected ? 'wrong' : ''}`}>
                    <span>{o.correct ? '✓' : o.selected ? '✗' : '·'}</span>
                    <span><ReactMarkdown components={{ p: 'span' }}>{o.text}</ReactMarkdown></span>
                    {o.selected && <em className="muted"> your answer</em>}
                  </li>
                ))}
              </ul>
              <p className="muted explain">{q.review.explain}</p>
            </>
          )}
          {q.code && (
            <>
              {q.code.runError && <pre className="out err">{q.code.runError}</pre>}
              <ul className="tests">
                {q.code.tests.map((t) => (
                  <li key={t.name} className={t.passed ? 'pass' : 'fail'}>
                    <span>{t.passed ? '✓' : '✗'}</span>
                    <div><code>{t.name}</code>{!t.passed && t.message && <pre className="out err">{t.message}</pre>}</div>
                  </li>
                ))}
                {q.code.hidden?.total > 0 && (
                  <li className={q.code.hidden.passed === q.code.hidden.total ? 'pass' : 'fail'}>
                    <span>{q.code.hidden.passed === q.code.hidden.total ? '✓' : '✗'}</span>
                    <div>Hidden tests: {q.code.hidden.passed}/{q.code.hidden.total} passed</div>
                  </li>
                )}
              </ul>
            </>
          )}
        </div>
      ))}
      <div className="row-gap" style={{ marginTop: '1.5rem' }}>
        <Link className="btn primary" to={`/assessments/${assessment.slug}`}>Back to the assessment</Link>
        <Link className="btn" to="/assessments">All assessments</Link>
      </div>
    </div>
  );
}
