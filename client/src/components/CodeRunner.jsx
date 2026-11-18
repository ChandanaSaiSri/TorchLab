import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { api } from '../api.js';
import AiAssist from './AiAssist.jsx';

/**
 * Monaco editor + Run button + output console.
 * `code`/`onChange` are controlled by the parent so it can save/reset.
 */
export default function CodeRunner({ code, onChange, notebookId, height = 320, extraActions, aiContext, onRan }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const runRef = useRef(() => {});

  const run = async () => {
    if (running) return;
    setRunning(true);
    setError('');
    try {
      const r = await api.post('/api/compiler/execute', { code, notebookId });
      setResult(r);
      onRan?.(r);
    } catch (e) {
      setResult(null);
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };
  runRef.current = run;

  useEffect(() => {
    setResult(null);
    setError('');
  }, [notebookId]);

  return (
    <div className="runner">
      <div className="runner-bar">
        <span className="chip">Python 3 · CPU</span>
        <div className="spacer" />
        {extraActions}
        <button className="btn primary" onClick={run} disabled={running}>
          {running ? 'Running…' : '▶ Run'}
        </button>
      </div>
      <Editor
        height={height}
        language="python"
        theme="vs-dark"
        value={code}
        onChange={(v) => onChange(v ?? '')}
        onMount={(editor, monaco) => {
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
        }}
        options={{ minimap: { enabled: false }, fontSize: 14, fontFamily: 'JetBrains Mono, monospace', scrollBeyondLastLine: false, tabSize: 4 }}
      />
      <div className="console" aria-live="polite">
        <div className="console-head">
          Output
          {result && (
            <span className={`status ${result.status}`}>
              {result.status} · {(result.runtime_ms / 1000).toFixed(2)}s
            </span>
          )}
          <span className="muted hint">Ctrl/⌘ + Enter to run</span>
        </div>
        {error && <pre className="out err">{error}</pre>}
        {!error && !result && <pre className="out muted">Run your code to see output here.</pre>}
        {result?.stdout && <pre className="out">{result.stdout}</pre>}
        {result?.stderr && <pre className="out err">{result.stderr}</pre>}
        {result?.images?.map((im) => (
          <figure key={im.name} className="plot">
            <img src={`data:image/png;base64,${im.data}`} alt={im.name} />
            <figcaption className="muted">{im.name}</figcaption>
          </figure>
        ))}
        {result && !result.stdout && !result.stderr && !result.images?.length && <pre className="out muted">(no output)</pre>}
      </div>
      {aiContext && <AiAssist code={code} output={error || result?.stderr || result?.stdout || ''} context={aiContext} />}
    </div>
  );
}
