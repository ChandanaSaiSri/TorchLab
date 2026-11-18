import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import CodeRunner from '../components/CodeRunner.jsx';
import NotebookEditor from '../components/NotebookEditor.jsx';
import { SAMPLES } from '../data/samples.js';

const DEFAULT = `import torch

x = torch.tensor([1.0, 2.0, 3.0])
print(x * 2)
print(x.mean())
`;
const DEFAULT_CELLS = ['import torch\n\nx = torch.tensor([1.0, 2.0, 3.0])', 'print(x * 2)\nprint(x.mean())'];
export const DRAFT_KEY = 'torchlab:playground-draft';
const CELLS_KEY = 'torchlab:playground-cells';

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };
const readCells = () => { try { const v = JSON.parse(read(CELLS_KEY)); return Array.isArray(v) && v.length ? v : null; } catch { return null; } };

export default function Playground() {
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState([]);
  const [current, setCurrent] = useState(null); // saved program (list fields) or null
  const [kind, setKind] = useState('script');
  const [title, setTitle] = useState('Untitled');
  const [code, setCode] = useState(() => read(DRAFT_KEY) ?? DEFAULT);
  const [cells, setCells] = useState(() => readCells() ?? DEFAULT_CELLS);
  const [msg, setMsg] = useState('');
  const [history, setHistory] = useState(null);
  const [panel, setPanel] = useState(null); // 'samples' | 'data' | 'runtime'
  const [q, setQ] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const flashT = useRef(0);

  const loadList = useCallback(() => api.get('/api/compiler/notebooks').then((d) => setList(d.notebooks)).catch(() => {}), []);
  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    const t = setTimeout(() => { write(DRAFT_KEY, code); write(CELLS_KEY, JSON.stringify(cells)); }, 500);
    return () => clearTimeout(t);
  }, [code, cells]);

  // /playground?mode=notebook starts a fresh notebook (used by the Explore page's "try in Playground")
  useEffect(() => {
    if (params.get('mode') === 'notebook') { setKind('notebook'); setParams({}, { replace: true }); }
  }, [params, setParams]);

  const flash = (m) => { setMsg(m); clearTimeout(flashT.current); flashT.current = setTimeout(() => setMsg(''), 3000); };
  const savedOk = (n) => { setCurrent(n); loadList(); };

  const body = () => (kind === 'notebook' ? { title, kind, cells } : { title, kind, code });
  const save = async () => {
    try {
      if (current) {
        const { notebook } = await api.put(`/api/compiler/notebooks/${current.id}`, body());
        savedOk(notebook);
      } else {
        const { notebook } = await api.post('/api/compiler/notebooks', body());
        savedOk(notebook);
      }
      flash('Saved');
    } catch (e) { flash(e.message); }
  };

  const open = async (id) => {
    const { notebook: n } = await api.get(`/api/compiler/notebooks/${id}`);
    setCurrent(n); setTitle(n.title); setKind(n.kind || 'script'); setShareUrl('');
    if (n.kind === 'notebook') setCells(n.cells?.length ? n.cells : [n.code]); else setCode(n.code);
  };
  const newProgram = (k = kind) => { setCurrent(null); setTitle('Untitled'); setShareUrl(''); setKind(k); if (k === 'notebook') setCells(DEFAULT_CELLS); else setCode(DEFAULT); };
  const remove = async (n) => {
    if (!confirm(`Delete "${n.title}"?`)) return;
    await api.del(`/api/compiler/notebooks/${n.id}`);
    if (current?.id === n.id) newProgram();
    loadList();
  };
  const toggle = async (n, field) => {
    const { notebook } = await api.patch(`/api/compiler/notebooks/${n.id}`, { [field]: !n[field] });
    if (current?.id === n.id) setCurrent((c) => ({ ...c, ...notebook }));
    loadList();
  };
  const share = async () => {
    if (!current) return flash('Save first, then share');
    try {
      const { token } = await api.post(`/api/compiler/notebooks/${current.id}/share`);
      const url = `${location.origin}/s/${token}`;
      setShareUrl(url);
      try { await navigator.clipboard.writeText(url); flash('Link copied'); } catch { flash('Link ready below'); }
      loadList();
    } catch (e) { flash(e.message); }
  };
  const unshare = async () => { await api.del(`/api/compiler/notebooks/${current.id}/share`); setShareUrl(''); flash('Sharing turned off'); loadList(); };
  const useSample = (s) => {
    setCurrent(null); setTitle(s.title); setShareUrl(''); setKind(s.kind);
    if (s.kind === 'notebook') setCells(s.cells); else setCode(s.code);
    setPanel(null);
  };
  const showHistory = async () => setHistory((await api.get('/api/compiler/history')).executions);

  const needle = q.trim().toLowerCase();
  const match = (n) => !needle || n.title.toLowerCase().includes(needle);
  const favs = list.filter((n) => n.favorite && !n.archived && match(n));
  const rest = list.filter((n) => !n.favorite && !n.archived && match(n));
  const arch = list.filter((n) => n.archived && match(n));
  const Row = ({ n }) => (
    <li className={`nb ${current?.id === n.id ? 'active' : ''}`}>
      <button className="link" onClick={() => open(n.id)}>{n.kind === 'notebook' ? '▤ ' : ''}{n.title}{n.shared ? ' 🔗' : ''}</button>
      <span className="nb-actions">
        <button className="icon" onClick={() => toggle(n, 'favorite')} aria-label={`${n.favorite ? 'Unfavorite' : 'Favorite'} ${n.title}`}>{n.favorite ? '★' : '☆'}</button>
        <button className="icon" onClick={() => toggle(n, 'archived')} aria-label={`${n.archived ? 'Restore' : 'Archive'} ${n.title}`}>{n.archived ? '↩' : '🗄'}</button>
        <button className="icon" onClick={() => remove(n)} aria-label={`Delete ${n.title}`}>✕</button>
      </span>
    </li>
  );

  const ctx = { kind: 'playground' };
  return (
    <>
      <div className="row-between"><h1>Playground</h1>
        <div className="row-gap">
          <button className="btn ghost" onClick={() => setPanel(panel === 'samples' ? null : 'samples')}>Samples</button>
          <button className="btn ghost" onClick={() => setPanel(panel === 'data' ? null : 'data')}>Datasets</button>
          <button className="btn ghost" onClick={() => setPanel(panel === 'runtime' ? null : 'runtime')}>Runtime info</button>
        </div>
      </div>

      {panel === 'samples' && <Samples onUse={useSample} />}
      {panel === 'data' && <Datasets />}
      {panel === 'runtime' && <Runtime />}

      <div className="playground">
        <aside className="card side">
          <div className="row-between"><h3>My programs</h3>
            <span className="row-gap" style={{ margin: 0 }}>
              <button className="btn small" onClick={() => newProgram('script')}>+ Script</button>
              <button className="btn small" onClick={() => newProgram('notebook')}>+ Notebook</button>
            </span>
          </div>
          <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search programs" />
          {list.length === 0 && <p className="muted">Nothing saved yet.</p>}
          {favs.length > 0 && <><h4 className="sm">★ Favorites</h4><ul className="plain">{favs.map((n) => <Row key={n.id} n={n} />)}</ul></>}
          {rest.length > 0 && <><h4 className="sm">Programs</h4><ul className="plain">{rest.map((n) => <Row key={n.id} n={n} />)}</ul></>}
          {arch.length > 0 && <details><summary className="sm">Archived ({arch.length})</summary><ul className="plain">{arch.map((n) => <Row key={n.id} n={n} />)}</ul></details>}
          {needle && !favs.length && !rest.length && !arch.length && <p className="muted">No matches.</p>}
          <button className="btn ghost block" onClick={showHistory}>Execution history</button>
        </aside>

        <div className="grow">
          <div className="row-gap">
            <input className="title-input" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Program name" maxLength={100} />
            <span className="chip">{kind === 'notebook' ? 'Notebook' : 'Script'}</span>
            <button className="btn" onClick={save}>Save</button>
            {current && <button className="btn ghost" onClick={share}>{current.shared || shareUrl ? 'Copy share link' : 'Share'}</button>}
            {msg && <span className="muted" role="status">{msg}</span>}
          </div>
          {(shareUrl || current?.shared) && current && (
            <p className="muted sm">Anyone with the link can view a read-only copy. {shareUrl && <code>{shareUrl}</code>} <button className="link" onClick={unshare}>Turn off sharing</button></p>
          )}
          {kind === 'notebook'
            ? <NotebookEditor cells={cells} onChange={setCells} notebookId={current?.id} aiContext={ctx} />
            : <CodeRunner code={code} onChange={setCode} notebookId={current?.id} height={420} aiContext={ctx} />}
        </div>
      </div>

      {history && (
        <div className="modal" onClick={() => setHistory(null)}>
          <div className="card modal-body" onClick={(e) => e.stopPropagation()}>
            <div className="row-between"><h3>Execution history</h3><button className="btn small" onClick={() => setHistory(null)}>Close</button></div>
            {history.length === 0 && <p className="muted">No runs yet.</p>}
            {history.map((h) => (
              <div key={h.id} className="hist">
                <div className="row-between">
                  <span><span className={`dot ${h.status}`} /> {h.status} · {(h.runtime_ms / 1000).toFixed(2)}s · <span className="muted">{new Date(h.created_at).toLocaleString()}</span></span>
                  <button className="btn small" onClick={() => { setKind('script'); setCode(h.code); setCurrent(null); setHistory(null); }}>Open code</button>
                </div>
                <pre className="out">{(h.stdout || h.stderr || '(no output)').slice(0, 300)}</pre>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="muted sm">New to this? <Link to="/explore">Explore tensors and model shapes →</Link></p>
    </>
  );
}

function Samples({ onUse }) {
  return (
    <section className="card" aria-label="Samples">
      <h3>Sample programs</h3>
      <div className="grid-cards">
        {SAMPLES.map((s) => (
          <div key={s.id} className="sample">
            <strong>{s.title}</strong> <span className="chip">{s.kind}</span>
            <p className="muted sm">{s.blurb}</p>
            <button className="btn small" onClick={() => onUse(s)}>Open</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Datasets() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const load = () => api.get('/api/compiler/datasets').then(setD).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const upload = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setErr('');
    if (f.size > (d?.limits?.bytesEach ?? 512000)) return setErr(`Each file can be up to ${Math.round((d?.limits?.bytesEach ?? 512000) / 1024)} KB`);
    try {
      const content = await f.text();
      await api.post('/api/compiler/datasets', { name: f.name, content });
      load();
    } catch (x) { setErr(x.message); }
  };
  const del = async (id) => { await api.del(`/api/compiler/datasets/${id}`); load(); };
  return (
    <section className="card" aria-label="Datasets">
      <h3>Your datasets</h3>
      <p className="muted sm">Text files (.csv, .tsv, .json, .txt) are placed next to your program on every run, so <code>open("name.csv")</code> or <code>pandas</code>-free parsing with <code>csv</code> works.</p>
      {err && <div className="alert err">{err}</div>}
      {d && (
        <>
          <ul className="plain">
            {d.datasets.map((x) => (
              <li key={x.id} className="row-between"><span><code>{x.name}</code> <span className="muted sm">{(x.bytes / 1024).toFixed(1)} KB</span></span>
                <button className="icon" onClick={() => del(x.id)} aria-label={`Delete ${x.name}`}>✕</button></li>
            ))}
            {d.datasets.length === 0 && <li className="muted">No files yet.</li>}
          </ul>
          <p className="muted sm">{d.datasets.length}/{d.limits.files} files · {(d.usedBytes / 1024).toFixed(0)} of {Math.round(d.limits.bytesTotal / 1024)} KB used</p>
        </>
      )}
      <label className="btn small">Upload a file<input type="file" accept=".csv,.tsv,.json,.txt" onChange={upload} hidden /></label>
    </section>
  );
}

function Runtime() {
  const [r, setR] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.get('/api/compiler/runtime').then(setR).catch((e) => setErr(e.message)); }, []);
  return (
    <section className="card" aria-label="Runtime info">
      <h3>Runtime</h3>
      {err && <div className="alert err">{err}</div>}
      {r && (
        <table className="kv"><tbody>
          {Object.entries(r).filter(([, v]) => typeof v !== 'object').map(([k, v]) => <tr key={k}><td className="muted">{k.replace(/_/g, ' ')}</td><td><code>{String(v)}</code></td></tr>)}
          {r.libraries && Object.entries(r.libraries).map(([k, v]) => <tr key={k}><td className="muted">{k}</td><td><code>{String(v)}</code></td></tr>)}
          {r.limits && Object.entries(r.limits).map(([k, v]) => <tr key={k}><td className="muted">limit: {k.replace(/_/g, ' ')}</td><td><code>{String(v)}</code></td></tr>)}
        </tbody></table>
      )}
    </section>
  );
}
