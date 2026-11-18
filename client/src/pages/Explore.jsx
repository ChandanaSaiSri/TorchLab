import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { runChain, parseInts, format, MAX_ELEMENTS } from '../lib/tensorSim.js';
import { analyze, PRESETS, toCode, SUPPORTED } from '../lib/modelSim.js';
import { DRAFT_KEY } from './Playground.jsx';

const OPS = [
  ['reshape', 'reshape', '3, -1'], ['view', 'view', '-1'], ['permute', 'permute', '1, 0'], ['transpose', 'transpose', '0, 1'],
  ['unsqueeze', 'unsqueeze', '0'], ['squeeze', 'squeeze (optional dim)', ''], ['index', 'index / slice', '0, :'],
  ['sum', 'sum (dim, keepdim)', '0'], ['mean', 'mean (dim, keepdim)', '1'], ['max', 'max (dim)', '0'], ['min', 'min (dim)', '0'],
  ['add', 'add tensor of shape… (broadcast)', '4'], ['matmul', 'matmul with tensor of shape…', '4, 2'],
];

export default function Explore() {
  const [tab, setTab] = useState('tensor');
  return (
    <>
      <h1>Explore</h1>
      <p className="muted">Two tools for building intuition. Nothing here runs on the server, so it is instant.</p>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'tensor'} className={`tab ${tab === 'tensor' ? 'active' : ''}`} onClick={() => setTab('tensor')}>Tensor explorer</button>
        <button role="tab" aria-selected={tab === 'model'} className={`tab ${tab === 'model' ? 'active' : ''}`} onClick={() => setTab('model')}>Model architecture</button>
      </div>
      {tab === 'tensor' ? <TensorExplorer /> : <ModelVisualizer />}
    </>
  );
}

function toPlayground(nav, code) {
  try { localStorage.setItem(DRAFT_KEY, code); } catch { /* storage unavailable */ }
  nav('/playground');
}

function TensorExplorer() {
  const nav = useNavigate();
  const [base, setBase] = useState('2, 3, 4');
  const [steps, setSteps] = useState([{ op: 'permute', arg: '2, 0, 1' }, { op: 'reshape', arg: '4, -1' }]);
  const parsed = useMemo(() => {
    try {
      const shape = parseInts(base);
      return { shape, ...runChain(shape, steps) };
    } catch (e) { return { error: e.message }; }
  }, [base, steps]);
  const setStep = (i, patch) => setSteps(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const changeOp = (i, op) => setStep(i, { op, arg: OPS.find((o) => o[0] === op)[2] });

  return (
    <div className="explore">
      <section className="card">
        <label>Start with <code>torch.arange(…).reshape(</code>
          <input value={base} onChange={(e) => setBase(e.target.value)} aria-label="Starting shape" style={{ maxWidth: 200, display: 'inline-block', margin: '0 .4rem' }} />
          <code>)</code></label>
        <span className="muted sm"> up to {MAX_ELEMENTS} elements</span>
        {parsed.error && <div className="alert err">{parsed.error}</div>}
        {parsed.shape && <p>Shape: <strong>{`(${parsed.shape.join(', ')})`}</strong></p>}
      </section>

      {parsed.shape && steps.map((s, i) => {
        const r = parsed.steps[i];
        const prev = i === 0 ? null : parsed.steps[i - 1];
        if (i > 0 && (!prev || prev.error)) return <section key={i} className="card step off"><StepForm i={i} s={s} setStep={setStep} changeOp={changeOp} remove={() => setSteps(steps.filter((_, j) => j !== i))} /><p className="muted sm">Not run because an earlier step failed.</p></section>;
        return (
          <section key={i} className={`card step ${r?.error ? 'bad' : ''}`}>
            <StepForm i={i} s={s} setStep={setStep} changeOp={changeOp} remove={() => setSteps(steps.filter((_, j) => j !== i))} />
            {r?.error && <div className="alert err">RuntimeError: {r.error}</div>}
            {r?.tensor && (
              <>
                <p>Shape: <strong>{r.tensor.scalar ? '() — a single number' : `(${r.tensor.shape.join(', ')})`}</strong></p>
                <pre className="out tensor">{format(r.tensor)}</pre>
              </>
            )}
          </section>
        );
      })}
      <div className="row-gap">
        <button className="btn" disabled={steps.length >= 8} onClick={() => setSteps([...steps, { op: 'sum', arg: '0' }])}>+ Add step</button>
        {parsed.code && <button className="btn primary" onClick={() => toPlayground(nav, parsed.code)}>Try it in the Playground</button>}
      </div>
      {parsed.code && (
        <section className="card"><h3>Equivalent PyTorch</h3><pre className="out">{parsed.code}</pre></section>
      )}
    </div>
  );
}

function StepForm({ i, s, setStep, changeOp, remove }) {
  return (
    <div className="row-gap">
      <strong>Step {i + 1}</strong>
      <select value={s.op} onChange={(e) => changeOp(i, e.target.value)} aria-label={`Operation for step ${i + 1}`}>
        {OPS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
      <input value={s.arg} onChange={(e) => setStep(i, { arg: e.target.value })} aria-label={`Arguments for step ${i + 1}`} placeholder="arguments" style={{ maxWidth: 200 }} />
      <button className="icon" onClick={remove} aria-label={`Remove step ${i + 1}`}>✕</button>
    </div>
  );
}

function ModelVisualizer() {
  const nav = useNavigate();
  const [preset, setPreset] = useState('LeNet-5');
  const [layers, setLayers] = useState(PRESETS['LeNet-5'].layers);
  const [input, setInput] = useState(PRESETS['LeNet-5'].input.join(', '));
  const [copied, setCopied] = useState(false);
  const res = useMemo(() => {
    try { return { ...analyze(layers, parseInts(input)), inShape: parseInts(input) }; } catch (e) { return { error: e.message, rows: [], total: 0 }; }
  }, [layers, input]);
  const pick = (k) => { setPreset(k); setLayers(PRESETS[k].layers); setInput(PRESETS[k].input.join(', ')); };
  const code = res.inShape && res.rows.length ? toCode(res.rows, res.inShape) : '';
  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ } };
  const maxElems = Math.max(1, ...res.rows.filter((r) => r.shape).map((r) => r.shape.reduce((a, b) => a * b, 1)));

  return (
    <div className="explore">
      <section className="card">
        <div className="row-gap">
          <label>Preset <select value={preset} onChange={(e) => pick(e.target.value)}>{Object.keys(PRESETS).map((k) => <option key={k}>{k}</option>)}</select></label>
          <label>Input shape (no batch) <input value={input} onChange={(e) => setInput(e.target.value)} style={{ maxWidth: 160, display: 'inline-block' }} aria-label="Input shape" /></label>
        </div>
        <textarea className="nbcode" rows={9} value={layers} onChange={(e) => setLayers(e.target.value)} spellCheck={false} aria-label="Layers, one per line" />
        <p className="muted sm">One layer per line. Supported: {SUPPORTED.join(', ')}.</p>
      </section>

      {res.error && <div className="alert err" role="alert">{res.error}</div>}
      {res.rows.length > 0 && (
        <section className="card">
          <table className="layers">
            <thead><tr><th>#</th><th>Layer</th><th>Output shape</th><th>Parameters</th><th aria-label="size" /></tr></thead>
            <tbody>
              <tr className="muted"><td /><td>Input</td><td>{res.inShape && `(${res.inShape.join(', ')})`}</td><td /><td /></tr>
              {res.rows.map((r, i) => (
                <tr key={i} className={r.error ? 'bad' : ''}>
                  <td>{i + 1}</td><td><code>{r.text}</code>{r.error && <div className="err sm">{r.error}</div>}</td>
                  <td>{r.shape ? `(${r.shape.join(', ')})` : '—'}</td>
                  <td>{r.params ? r.params.toLocaleString() : r.error ? '' : '0'}</td>
                  <td>{r.shape && <span className="bar" style={{ width: `${Math.max(3, (Math.log(r.shape.reduce((a, b) => a * b, 1) + 1) / Math.log(maxElems + 1)) * 100)}%` }} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p><strong>Total parameters:</strong> {res.total.toLocaleString()}{res.outShape && <> · <strong>Output:</strong> {`(${res.outShape.join(', ')})`}</>}</p>
          {code && (
            <div className="row-gap">
              <button className="btn" onClick={copy}>{copied ? 'Copied' : 'Copy as PyTorch code'}</button>
              <button className="btn primary" onClick={() => toPlayground(nav, code)}>Try it in the Playground</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
