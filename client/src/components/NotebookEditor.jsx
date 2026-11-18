import { useRef, useState } from 'react';
import { api } from '../api.js';
import AiAssist from './AiAssist.jsx';

export const MAX_CELLS = 30;

/** Notebook cells. Running a cell re-runs every cell above it (like a restarted kernel), so state is never stale. */
export default function NotebookEditor({ cells, onChange, notebookId, aiContext }) {
  const [res, setRes] = useState(null); // last run: {upTo, status, cells, errorCell, stderr, images, runtime_ms}
  const [running, setRunning] = useState(null); // index or 'all'
  const [error, setError] = useState('');
  const [focus, setFocus] = useState(0);
  const refs = useRef([]);

  const set = (i, v) => onChange(cells.map((c, j) => (j === i ? v : c)));
  const add = (at) => {
    if (cells.length >= MAX_CELLS) return;
    const next = [...cells]; next.splice(at, 0, '');
    onChange(next); setRes(null);
    setTimeout(() => refs.current[at]?.focus(), 30);
  };
  const del = (i) => { if (cells.length > 1) { onChange(cells.filter((_, j) => j !== i)); setRes(null); } };
  const move = (i, d) => {
    const j = i + d; if (j < 0 || j >= cells.length) return;
    const next = [...cells]; [next[i], next[j]] = [next[j], next[i]];
    onChange(next); setRes(null);
  };

  const run = async (upTo) => {
    if (running !== null) return;
    setRunning(upTo === undefined ? 'all' : upTo); setError('');
    try {
      const idx = upTo === undefined ? cells.length - 1 : upTo;
      const r = await api.post('/api/compiler/execute-cells', { cells, upTo: idx, notebookId });
      setRes({ ...r, upTo: idx });
    } catch (e) { setRes(null); setError(e.message); }
    finally { setRunning(null); }
  };

  const key = (e, i) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const t = e.target, s = t.selectionStart;
      set(i, t.value.slice(0, s) + '    ' + t.value.slice(t.selectionEnd));
      setTimeout(() => { t.selectionStart = t.selectionEnd = s + 4; }, 0);
    } else if (e.key === 'Enter' && (e.shiftKey || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      run(i).then(() => { if (e.shiftKey) { if (i === cells.length - 1) add(i + 1); else refs.current[i + 1]?.focus(); } });
    }
  };

  const output = (i) => {
    if (!res || i > res.upTo) return null;
    const c = res.cells[i];
    const isErr = res.errorCell === i;
    return (
      <div className="nb-out" aria-live="polite">
        {c?.output && <pre className="out">{c.output.replace(/^\n/, '')}</pre>}
        {isErr && <pre className="out err">{res.stderr || res.status}</pre>}
        {i === res.upTo && res.images?.map((im) => (
          <figure key={im.name} className="plot"><img src={`data:image/png;base64,${im.data}`} alt={im.name} /><figcaption className="muted">{im.name}</figcaption></figure>
        ))}
        {!c?.output && !isErr && c?.ran && <pre className="out muted">(no output)</pre>}
      </div>
    );
  };

  const failOut = res?.status !== 'success' && res ? res.stderr : '';
  return (
    <div className="nbed">
      <div className="runner-bar">
        <span className="chip">Notebook · {cells.length} cell{cells.length === 1 ? '' : 's'}</span>
        {res && <span className={`status ${res.status}`}>{res.status} · {(res.runtime_ms / 1000).toFixed(2)}s</span>}
        <div className="spacer" />
        <button className="btn small" onClick={() => add(cells.length)} disabled={cells.length >= MAX_CELLS}>+ Cell</button>
        <button className="btn primary small" onClick={() => run()} disabled={running !== null}>{running === 'all' ? 'Running…' : '▶ Run all'}</button>
      </div>
      <p className="muted sm" style={{ margin: '.3rem 0 .6rem' }}>Running a cell re-runs the cells above it first, so variables are always fresh. Shift+Enter runs and moves on. Tab indents.</p>
      {error && <div className="alert err">{error}</div>}
      {cells.map((c, i) => (
        <div key={i} className={`nbcell ${focus === i ? 'focus' : ''} ${res?.errorCell === i ? 'bad' : ''}`}>
          <div className="nbcell-bar">
            <span className="muted sm">[{i + 1}]</span>
            <button className="btn small" onClick={() => run(i)} disabled={running !== null} aria-label={`Run cell ${i + 1}`}>{running === i ? '…' : '▶'}</button>
            <div className="spacer" />
            <button className="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move cell ${i + 1} up`}>↑</button>
            <button className="icon" onClick={() => move(i, 1)} disabled={i === cells.length - 1} aria-label={`Move cell ${i + 1} down`}>↓</button>
            <button className="icon" onClick={() => add(i + 1)} disabled={cells.length >= MAX_CELLS} aria-label={`Add cell after ${i + 1}`}>＋</button>
            <button className="icon" onClick={() => del(i)} disabled={cells.length === 1} aria-label={`Delete cell ${i + 1}`}>✕</button>
          </div>
          <textarea ref={(el) => { refs.current[i] = el; }} className="nbcode" spellCheck={false} rows={Math.min(14, Math.max(3, c.split('\n').length + 1))}
            value={c} onChange={(e) => set(i, e.target.value)} onKeyDown={(e) => key(e, i)} onFocus={() => setFocus(i)} aria-label={`Cell ${i + 1} code`} maxLength={20000} />
          {output(i)}
        </div>
      ))}
      {aiContext && <AiAssist code={cells.join('\n\n')} output={failOut} context={aiContext} />}
    </div>
  );
}
