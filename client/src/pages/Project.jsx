import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import Editor from '@monaco-editor/react';
import AiAssist from '../components/AiAssist.jsx';
import { api } from '../api.js';
import { LevelBadge } from './Projects.jsx';

const ICON = { passed: '✅', open: '🟡', locked: '🔒' };

export default function Project() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [sel, setSel] = useState(1);
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState(null);
  const [runOut, setRunOut] = useState(null);
  const [notice, setNotice] = useState('');
  const [solutions, setSolutions] = useState({});
  const [saved, setSaved] = useState(true);
  const dirty = useRef(false);
  const submitRef = useRef(() => {});

  const apply = useCallback((d) => {
    setData(d);
    setCode(d.code);
    const open = d.milestones.filter((m) => m.status !== 'locked');
    setSel(d.progress.completed ? 1 : open.length ? open[open.length - 1].position : 1);
  }, []);

  useEffect(() => {
    setData(null); setResult(null); setRunOut(null); setSolutions({}); setNotice(''); setError('');
    api.get(`/api/projects/${slug}`).then(apply).catch((e) => setError(e.message));
    window.scrollTo(0, 0);
  }, [slug, apply]);

  // autosave 1.5 s after the last edit
  const started = data?.progress.started;
  useEffect(() => {
    if (!started || !dirty.current) return undefined;
    setSaved(false);
    const t = setTimeout(() => {
      api.put(`/api/projects/${slug}/code`, { code }).then(() => { dirty.current = false; setSaved(true); }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [code, started, slug]);

  if (error) return <div className="alert err">{error}</div>;
  if (!data) return <div className="muted">Loading…</div>;
  const { project, milestones, progress } = data;
  const m = milestones.find((x) => x.position === sel) || milestones[0];
  const completed = progress.completed || result?.completed;
  const certificate = result?.certificate || data.certificate;

  const start = async () => {
    try {
      await api.post(`/api/projects/${slug}/start`);
      apply(await api.get(`/api/projects/${slug}`));
    } catch (e) { setNotice(e.message); }
  };

  const edit = (v) => { dirty.current = true; setCode(v ?? ''); };

  const run = async () => {
    if (busy) return;
    setBusy('run'); setNotice('');
    try { setRunOut(await api.post(`/api/projects/${slug}/run`, { code })); }
    catch (e) { setRunOut(null); setNotice(e.message); }
    finally { setBusy(''); }
  };

  const submit = async () => {
    if (busy || !m || m.status === 'locked') return;
    setBusy('submit'); setNotice(''); setRunOut(null);
    try {
      const r = await api.post(`/api/projects/${slug}/milestones/${m.position}/submit`, { code });
      setResult({ ...r, milestone: m.position });
      dirty.current = false; setSaved(true);
      if (r.passed) setCode(r.code);                       // the next milestone's starter was appended
      const fresh = await api.get(`/api/projects/${slug}`);
      setData(fresh);
      if (r.passed && r.unlocked > m.position) setSel(r.unlocked);
    } catch (e) { setResult(null); setNotice(e.message); }
    finally { setBusy(''); }
  };
  submitRef.current = submit;

  const hint = async () => {
    try {
      await api.post(`/api/projects/${slug}/milestones/${m.position}/hint`);
      setData(await api.get(`/api/projects/${slug}`));
    } catch (e) { setNotice(e.message); }
  };

  const showSolution = async () => {
    try {
      const r = await api.post(`/api/projects/${slug}/milestones/${m.position}/solution`);
      setSolutions((s) => ({ ...s, [m.position]: r.solution }));
    } catch (e) { setNotice(e.message); }
  };

  return (
    <div>
      <p className="muted"><Link to="/projects">← Live Projects</Link></p>
      <h1>{project.title} {completed && <span className="chip ok">Completed</span>}</h1>
      <div className="row-gap">
        <LevelBadge level={project.level} />
        <span className="chip">~{project.hours} h</span>
        <span className="chip">{project.xp} XP + certificate</span>
        {project.skills.map((s) => <span className="chip soft" key={s}>{s}</span>)}
      </div>

      {completed && certificate && (
        <div className="alert ok">
          🎉 Project complete{result?.xpAwarded ? ` · +${result.xpAwarded} XP` : ''}. Your certificate is ready:{' '}
          <Link to={`/verify/${certificate}`}><strong>{certificate}</strong></Link> · <Link to="/portfolio">View portfolio</Link>
        </div>
      )}

      {!progress.started ? (
        <div className="card">
          <div className="prose"><ReactMarkdown>{project.overview_md}</ReactMarkdown></div>
          <h3>Milestones</h3>
          <ol>{milestones.map((x) => <li key={x.position}>{x.title}</li>)}</ol>
          {notice && <div className="alert err">{notice}</div>}
          <button className="btn primary" onClick={start}>Start project</button>
        </div>
      ) : (
        <div className="project-ws">
          <section>
            <ol className="stepper">
              {milestones.map((x) => (
                <li key={x.position}>
                  <button className={`${x.position === sel ? 'active' : ''} ${x.status}`} disabled={x.status === 'locked'} onClick={() => { setSel(x.position); setResult(null); }}>
                    <span>{ICON[x.status]}</span> {x.position}. {x.title}
                  </button>
                </li>
              ))}
            </ol>
            <details className="overview">
              <summary>Project overview</summary>
              <div className="prose"><ReactMarkdown>{project.overview_md}</ReactMarkdown></div>
            </details>

            <h2>Milestone {m.position}: {m.title}</h2>
            <div className="prose"><ReactMarkdown>{m.description_md || ''}</ReactMarkdown></div>

            <h3>Hints</h3>
            {m.hints.map((h, i) => <div className="hint-box" key={i}><strong>Hint {i + 1}.</strong> <ReactMarkdown>{h}</ReactMarkdown></div>)}
            {m.hints.length < m.hintsTotal
              ? <button className="btn small" onClick={hint}>Show hint {m.hints.length + 1} of {m.hintsTotal}</button>
              : m.hintsTotal === 0 && <span className="muted">No hints for this one.</span>}

            <h3>Reference solution</h3>
            {solutions[m.position] ? <pre className="solution"><code>{solutions[m.position]}</code></pre>
              : m.solutionUnlocked ? <button className="btn small" onClick={showSolution}>Show reference solution for this milestone</button>
              : <span className="muted">Unlocks after 3 attempts ({m.attempts} so far) or once the milestone is passed. Projects award XP on completion either way.</span>}
          </section>

          <section>
            <div className="runner">
              <div className="runner-bar">
                <span className="chip">main.py · Python 3 · CPU</span>
                <span className="muted small-note">{saved ? 'Saved' : 'Saving…'}</span>
                <div className="spacer" />
                <button className="btn" onClick={run} disabled={!!busy}>{busy === 'run' ? 'Running…' : '▶ Run'}</button>
                <button className="btn primary" onClick={submit} disabled={!!busy || m.status === 'locked'}>{busy === 'submit' ? 'Grading…' : `Check milestone ${m.position}`}</button>
              </div>
              <Editor
                height={560}
                language="python"
                theme="vs-dark"
                value={code}
                onChange={edit}
                onMount={(editor, monaco) => editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => submitRef.current())}
                options={{ minimap: { enabled: false }, fontSize: 14, fontFamily: 'JetBrains Mono, monospace', scrollBeyondLastLine: false, tabSize: 4 }}
              />
            </div>
            <p className="muted small-note">
              One growing program: each milestone adds a stub to the bottom. Helper modules such as the dataset generator are already importable. Run executes the whole file; Check grades the selected milestone. Ctrl/⌘ + Enter checks.
            </p>
            {notice && <div className="alert err">{notice}</div>}

            {runOut && (
              <div className="console">
                <div className="console-head">Run output <span className={`status ${runOut.status}`}>{runOut.status}</span></div>
                {runOut.stdout && <pre className="out">{runOut.stdout}</pre>}
                {runOut.stderr && <pre className="out err">{runOut.stderr}</pre>}
                {(runOut.images || []).map((im) => <img key={im.name} alt={im.name} className="plot" src={`data:image/png;base64,${im.data}`} />)}
                {!runOut.stdout && !runOut.stderr && <pre className="out muted">(no output)</pre>}
              </div>
            )}

            <AiAssist code={code} exercise context={{ kind: 'project', slug, milestone: m.position }}
              output={[runOut?.stderr, result?.milestone === m.position ? result?.runError : '', ...(result?.milestone === m.position ? (result?.visible || []) : []).filter((t) => !t.passed).map((t) => `${t.name}: ${t.message || 'failed'}`)].filter(Boolean).join('\n')} />

            {result && result.milestone === m.position && (
              <div className="card results">
                {result.passed
                  ? <div className="alert ok">Milestone {m.position} passed!{result.unlocked > m.position && ' The next milestone is unlocked and its starter was added to the bottom of your file.'}</div>
                  : <div className="alert err">{result.runError ? 'Your program did not finish, so the tests could not run.' : 'Some tests failed. Read the messages below and try again.'}</div>}
                {result.runError && <pre className="out err">{result.runError}</pre>}
                <ul className="tests">
                  {result.visible.map((t) => (
                    <li key={t.name} className={t.passed ? 'pass' : 'fail'}>
                      <span>{t.passed ? '✓' : '✗'}</span>
                      <div><code>{t.name}</code>{!t.passed && t.message && <pre className="out err">{t.message}</pre>}</div>
                    </li>
                  ))}
                  {result.hidden.total > 0 && (
                    <li className={result.hidden.passed === result.hidden.total ? 'pass' : 'fail'}>
                      <span>{result.hidden.passed === result.hidden.total ? '✓' : '✗'}</span>
                      <div>Hidden tests: {result.hidden.passed}/{result.hidden.total} passed</div>
                    </li>
                  )}
                </ul>
                {result.stdout && (<><div className="muted small-note">Your program printed:</div><pre className="out">{result.stdout}</pre></>)}
                <div className="muted small-note">Graded in {(result.runtime_ms / 1000).toFixed(2)}s · attempt {result.attempts}</div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
