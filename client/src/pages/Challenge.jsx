import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import Editor from '@monaco-editor/react';
import AiAssist from '../components/AiAssist.jsx';
import { api } from '../api.js';
import { DiffBadge } from './Practice.jsx';

export default function Challenge() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [hints, setHints] = useState([]);
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState(null);
  const [runOut, setRunOut] = useState(null);
  const [notice, setNotice] = useState('');
  const [solution, setSolution] = useState(null);
  const [history, setHistory] = useState([]);
  const submitRef = useRef(() => {});

  const load = () =>
    api
      .get(`/api/practice/challenges/${slug}`)
      .then((d) => {
        setData(d);
        setCode(d.progress.lastCode || d.challenge.starter_code);
        setHints(d.challenge.hints);
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    setData(null);
    setResult(null);
    setRunOut(null);
    setSolution(null);
    setNotice('');
    setError('');
    load();
    api.get(`/api/practice/challenges/${slug}/submissions`).then((d) => setHistory(d.submissions)).catch(() => {});
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (error) return <div className="alert err">{error}</div>;
  if (!data) return <div className="muted">Loading…</div>;
  const { challenge, progress } = data;
  const solved = progress.solved || result?.passed;
  const attempts = result?.attempts ?? progress.attempts;
  const solutionUnlocked = result?.solutionUnlocked ?? progress.solutionUnlocked;

  const submit = async () => {
    if (busy) return;
    setBusy('submit');
    setNotice('');
    setRunOut(null);
    try {
      const r = await api.post(`/api/practice/challenges/${slug}/submit`, { code });
      setResult(r);
      api.get(`/api/practice/challenges/${slug}/submissions`).then((d) => setHistory(d.submissions)).catch(() => {});
    } catch (e) {
      setResult(null);
      setNotice(e.message);
    } finally {
      setBusy('');
    }
  };
  submitRef.current = submit;

  const runOnly = async () => {
    if (busy) return;
    setBusy('run');
    setNotice('');
    try {
      setRunOut(await api.post('/api/compiler/execute', { code }));
    } catch (e) {
      setRunOut(null);
      setNotice(e.message);
    } finally {
      setBusy('');
    }
  };

  const nextHint = async () => {
    try {
      const h = await api.post(`/api/practice/challenges/${slug}/hint`);
      setHints((x) => [...x, h.hint]);
    } catch (e) {
      setNotice(e.message);
    }
  };

  const showSolution = async () => {
    if (!solved && !window.confirm('Viewing the solution before solving means this challenge will not award XP. Continue?')) return;
    try {
      setSolution(await api.post(`/api/practice/challenges/${slug}/solution`));
    } catch (e) {
      setNotice(e.message);
    }
  };

  return (
    <div className="challenge">
      <section>
        <p className="muted"><Link to="/practice">← Practice Arena</Link></p>
        <h1>
          {challenge.title} {solved && <span className="chip ok">Solved</span>}
        </h1>
        <div className="row-gap">
          <DiffBadge d={challenge.difficulty} />
          <span className="chip">{challenge.category}</span>
          <span className="chip">{challenge.xp} XP</span>
        </div>
        <div className="prose"><ReactMarkdown>{challenge.description_md}</ReactMarkdown></div>

        <h3>Hints</h3>
        {hints.map((h, i) => (
          <div className="hint-box" key={i}><strong>Hint {i + 1}.</strong> <ReactMarkdown>{h}</ReactMarkdown></div>
        ))}
        {hints.length < challenge.hintsTotal ? (
          <button className="btn small" onClick={nextHint}>Show hint {hints.length + 1} of {challenge.hintsTotal}</button>
        ) : (
          hints.length === 0 && <span className="muted">No hints for this one.</span>
        )}

        <h3>Solution</h3>
        {solution ? (
          <>
            {solution.forfeitedXp && <div className="alert err">You opened the solution before solving, so this challenge will not award XP.</div>}
            <pre className="solution"><code>{solution.solution}</code></pre>
          </>
        ) : solutionUnlocked ? (
          <button className="btn small" onClick={showSolution}>Show reference solution</button>
        ) : (
          <span className="muted">Unlocks after 3 attempts ({attempts} so far), or once you solve it.</span>
        )}

        {history.length > 0 && (
          <>
            <h3>Your submissions</h3>
            <ul className="history">
              {history.map((s) => (
                <li key={s.id}>
                  <button className="link-btn" title="Load this code into the editor" onClick={() => setCode(s.code)}>
                    {new Date(s.created_at).toLocaleString()}
                  </button>
                  <span className={`status ${s.passed ? 'success' : 'error'}`}>{s.passed ? 'passed' : `${s.tests_passed}/${s.tests_total} tests`}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section>
        <div className="runner">
          <div className="runner-bar">
            <span className="chip">Python 3 · CPU</span>
            <div className="spacer" />
            <button className="btn ghost" onClick={() => setCode(challenge.starter_code)}>Reset</button>
            <button className="btn" onClick={runOnly} disabled={!!busy}>{busy === 'run' ? 'Running…' : '▶ Run'}</button>
            <button className="btn primary" onClick={submit} disabled={!!busy}>{busy === 'submit' ? 'Grading…' : 'Submit'}</button>
          </div>
          <Editor
            height={420}
            language="python"
            theme="vs-dark"
            value={code}
            onChange={(v) => setCode(v ?? '')}
            onMount={(editor, monaco) => editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => submitRef.current())}
            options={{ minimap: { enabled: false }, fontSize: 14, fontFamily: 'JetBrains Mono, monospace', scrollBeyondLastLine: false, tabSize: 4 }}
          />
        </div>
        <p className="muted small-note">Run executes your code as is (use it to print and experiment). Submit grades it against the tests. Ctrl/⌘ + Enter submits.</p>

        {notice && <div className="alert err">{notice}</div>}

        {runOut && (
          <div className="console">
            <div className="console-head">Run output <span className={`status ${runOut.status}`}>{runOut.status}</span></div>
            {runOut.stdout && <pre className="out">{runOut.stdout}</pre>}
            {runOut.stderr && <pre className="out err">{runOut.stderr}</pre>}
            {!runOut.stdout && !runOut.stderr && <pre className="out muted">(no output)</pre>}
          </div>
        )}

        <AiAssist code={code} exercise context={{ kind: 'challenge', slug }}
          output={[runOut?.stderr, result?.runError, ...(result?.visible || []).filter((t) => !t.passed).map((t) => `${t.name}: ${t.message || 'failed'}`)].filter(Boolean).join('\n')} />

        {result && (
          <div className="card results">
            {result.passed ? (
              <div className="alert ok">
                All tests passed!{' '}
                {result.xpAwarded > 0 && <strong>+{result.xpAwarded} XP earned 🎉</strong>}
                {result.xpAwarded === 0 && result.alreadySolved && ' (XP already earned for this challenge)'}
                {result.xpAwarded === 0 && !result.alreadySolved && result.solvedWithoutSolution === false && ' (No XP, because the solution was viewed before solving)'}
              </div>
            ) : (
              <div className="alert err">
                {result.runError ? 'Your program did not finish, so the tests could not run.' : 'Some tests failed. Read the messages below and try again.'}
              </div>
            )}
            {result.runError && <pre className="out err">{result.runError}</pre>}
            <ul className="tests">
              {result.visible.map((t) => (
                <li key={t.name} className={t.passed ? 'pass' : 'fail'}>
                  <span>{t.passed ? '✓' : '✗'}</span>
                  <div>
                    <code>{t.name}</code>
                    {!t.passed && t.message && <pre className="out err">{t.message}</pre>}
                  </div>
                </li>
              ))}
              {result.hidden.total > 0 && (
                <li className={result.hidden.passed === result.hidden.total ? 'pass' : 'fail'}>
                  <span>{result.hidden.passed === result.hidden.total ? '✓' : '✗'}</span>
                  <div>Hidden tests: {result.hidden.passed}/{result.hidden.total} passed</div>
                </li>
              )}
            </ul>
            {result.stdout && (
              <>
                <div className="muted small-note">Your program printed:</div>
                <pre className="out">{result.stdout}</pre>
              </>
            )}
            <div className="muted small-note">Graded in {(result.runtime_ms / 1000).toFixed(2)}s · attempt {result.attempts}</div>
          </div>
        )}
      </section>
    </div>
  );
}
