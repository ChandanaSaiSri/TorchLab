// A tiny tensor simulator for the Explore page. Pure JS, no dependencies, shapes follow PyTorch's rules and messages.
const prod = (a) => a.reduce((x, y) => x * y, 1);
const stridesOf = (shape) => { const s = new Array(shape.length); let a = 1; for (let i = shape.length - 1; i >= 0; i--) { s[i] = a; a *= shape[i]; } return s; };
export const MAX_ELEMENTS = 5000;

export function make(shape) {
  if (!shape.length || shape.some((d) => !Number.isInteger(d) || d < 1)) throw new Error('Every size must be a whole number of at least 1');
  if (prod(shape) > MAX_ELEMENTS) throw new Error(`Keep it under ${MAX_ELEMENTS} elements so it stays readable`);
  return { shape: [...shape], data: Array.from({ length: prod(shape) }, (_, i) => i) };
}

export function reshape(t, dims) {
  const unknown = dims.filter((d) => d === -1).length;
  if (unknown > 1) throw new Error('only one dimension can be inferred (-1)');
  if (dims.some((d) => d === 0 || d < -1 || !Number.isInteger(d))) throw new Error('sizes must be positive whole numbers, or -1 for "work it out"');
  const known = prod(dims.filter((d) => d !== -1));
  const total = prod(t.shape);
  let out = dims;
  if (unknown) {
    if (total % known) throw new Error(`shape '[${dims.join(', ')}]' is invalid for input of size ${total}`);
    out = dims.map((d) => (d === -1 ? total / known : d));
  } else if (known !== total) throw new Error(`shape '[${dims.join(', ')}]' is invalid for input of size ${total}`);
  return { shape: out, data: t.data };
}

export function permute(t, order) {
  const n = t.shape.length;
  if (order.length !== n) throw new Error(`number of dims don't match in permute (tensor has ${n}, got ${order.length})`);
  if ([...order].sort((a, b) => a - b).some((v, i) => v !== i)) throw new Error(`permute needs each of 0..${n - 1} exactly once`);
  const shape = order.map((o) => t.shape[o]);
  const st = stridesOf(t.shape);
  const data = new Array(t.data.length);
  const idx = new Array(n).fill(0);
  for (let i = 0; i < data.length; i++) {
    let src = 0;
    for (let k = 0; k < n; k++) src += idx[k] * st[order[k]];
    data[i] = t.data[src];
    for (let k = n - 1; k >= 0; k--) { if (++idx[k] < shape[k]) break; idx[k] = 0; }
  }
  return { shape, data };
}

const normDim = (d, n, extra = 0) => {
  const lim = n + extra;
  if (!Number.isInteger(d) || d < -lim || d > lim - 1) throw new Error(`Dimension out of range (expected to be in range of [${-lim}, ${lim - 1}], but got ${d})`);
  return d < 0 ? d + lim : d;
};

export function transpose(t, a, b) {
  const n = t.shape.length;
  const x = normDim(a, n), y = normDim(b, n);
  const order = [...Array(n).keys()]; [order[x], order[y]] = [order[y], order[x]];
  return permute(t, order);
}

export function unsqueeze(t, d) { const k = normDim(d, t.shape.length, 1); const s = [...t.shape]; s.splice(k, 0, 1); return { shape: s, data: t.data }; }
export function squeeze(t, d) {
  if (d === undefined || d === null) { const s = t.shape.filter((x) => x !== 1); return { shape: s, data: t.data, scalar: s.length === 0 }; }
  const k = normDim(d, t.shape.length);
  return t.shape[k] === 1 ? { shape: t.shape.filter((_, i) => i !== k), data: t.data } : t;
}

/** Python-style index spec such as "0:2, :, 1" or "-1". Integers drop a dimension, slices keep it. */
export function index(t, spec) {
  const parts = spec.split(',').map((s) => s.trim());
  if (parts.length > t.shape.length) throw new Error(`too many indices for tensor of dimension ${t.shape.length}`);
  while (parts.length < t.shape.length) parts.push(':');
  const axes = parts.map((p, i) => {
    const n = t.shape[i];
    if (/^-?\d+$/.test(p)) {
      let v = Number(p); if (v < 0) v += n;
      if (v < 0 || v >= n) throw new Error(`index ${p} is out of bounds for dimension ${i} with size ${n}`);
      return { keep: false, list: [v] };
    }
    const m = p.match(/^(-?\d*):(-?\d*)(?::(\d+))?$/);
    if (!m) throw new Error(`can't read "${p}" — use a number like 1, or a slice like 0:2, :, 1:, ::2`);
    const step = m[3] ? Number(m[3]) : 1;
    if (step < 1) throw new Error('slice step must be at least 1');
    const clamp = (s, d) => { if (s === '') return d; let v = Number(s); if (v < 0) v += n; return Math.min(Math.max(v, 0), n); };
    const a = clamp(m[1], 0), b = clamp(m[2], n);
    const list = []; for (let v = a; v < b; v += step) list.push(v);
    return { keep: true, list };
  });
  const st = stridesOf(t.shape);
  const data = [];
  const rec = (k, off) => { if (k === axes.length) { data.push(t.data[off]); return; } for (const v of axes[k].list) rec(k + 1, off + v * st[k]); };
  rec(0, 0);
  const shape = axes.filter((a) => a.keep).map((a) => a.list.length);
  if (data.length === 0) return { shape: shape.length ? shape : [0], data, empty: true };
  return { shape, data, scalar: shape.length === 0 };
}

export function reduce(t, kind, dim, keepdim = false) {
  const f = { sum: (a) => a.reduce((x, y) => x + y, 0), mean: (a) => a.reduce((x, y) => x + y, 0) / a.length, max: (a) => a.reduce((x, y) => (y > x ? y : x)), min: (a) => a.reduce((x, y) => (y < x ? y : x)) }[kind];
  if (!f) throw new Error(`unknown reduction ${kind}`);
  if (dim === undefined || dim === null) return { shape: keepdim ? t.shape.map(() => 1) : [], data: [f(t.data)], scalar: !keepdim };
  const d = normDim(dim, t.shape.length);
  const moved = permute(t, [...t.shape.keys()].filter((i) => i !== d).concat(d));
  const len = t.shape[d];
  const data = [];
  for (let i = 0; i < moved.data.length; i += len) data.push(f(moved.data.slice(i, i + len)));
  const shape = t.shape.filter((_, i) => i !== d);
  return { shape: keepdim ? t.shape.map((s, i) => (i === d ? 1 : s)) : shape, data, scalar: !keepdim && shape.length === 0 };
}

export function broadcastShapes(a, b) {
  const n = Math.max(a.length, b.length), out = [];
  for (let i = 1; i <= n; i++) {
    const x = a[a.length - i] ?? 1, y = b[b.length - i] ?? 1;
    if (x !== y && x !== 1 && y !== 1) throw new Error(`The size of tensor a (${x}) must match the size of tensor b (${y}) at non-singleton dimension ${n - i}`);
    out.unshift(Math.max(x, y));
  }
  return out;
}

export function add(a, b) {
  const shape = broadcastShapes(a.shape, b.shape);
  const at = (t, idx) => { let off = 0; const st = stridesOf(t.shape); for (let k = 1; k <= t.shape.length; k++) { const j = t.shape.length - k; off += (t.shape[j] === 1 ? 0 : idx[idx.length - k]) * st[j]; } return t.data[off]; };
  const total = prod(shape), data = [], idx = new Array(shape.length).fill(0);
  for (let i = 0; i < total; i++) { data.push(at(a, idx) + at(b, idx)); for (let k = shape.length - 1; k >= 0; k--) { if (++idx[k] < shape[k]) break; idx[k] = 0; } }
  return { shape, data };
}

/** Shape rule for torch.matmul (1-D, 2-D and batched). */
export function matmulShape(a, b) {
  if (a.length === 0 || b.length === 0) throw new Error('both arguments to matmul need to be at least 1D');
  const A = a.length === 1 ? [1, a[0]] : a, B = b.length === 1 ? [b[0], 1] : b;
  if (A[A.length - 1] !== B[B.length - 2]) throw new Error(`mat1 and mat2 shapes cannot be multiplied (${A.slice(-2).join('x')} and ${B.slice(-2).join('x')})`);
  const batch = broadcastShapes(A.slice(0, -2), B.slice(0, -2));
  const out = [...batch, A[A.length - 2], B[B.length - 1]];
  if (a.length === 1) out.splice(out.length - 2, 1);
  if (b.length === 1) out.splice(out.length - 1, 1);
  return out;
}
export function matmul(a, b) {
  const shape = matmulShape(a.shape, b.shape);
  if (a.shape.length !== 2 || b.shape.length !== 2) return { shape, data: null };
  const [m, k] = a.shape, n = b.shape[1], data = [];
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) { let s = 0; for (let x = 0; x < k; x++) s += a.data[i * k + x] * b.data[x * n + j]; data.push(s); }
  return { shape, data };
}

export const parseInts = (s) => {
  const parts = String(s).split(/[,\s]+/).filter(Boolean);
  if (!parts.length) throw new Error('Type some numbers, like 2, 3, 4');
  const v = parts.map(Number);
  if (v.some((x) => !Number.isInteger(x))) throw new Error('Use whole numbers only');
  return v;
};
const one = (s) => { const v = parseInts(s); if (v.length !== 1) throw new Error('Give one number'); return v[0]; };

/** Apply one step. Returns {tensor, code}. */
export function applyStep(t, step) {
  const { op, arg = '' } = step;
  const a = String(arg).trim();
  switch (op) {
    case 'reshape': { const d = parseInts(a); return { tensor: reshape(t, d), code: `.reshape(${d.join(', ')})` }; }
    case 'view': { const d = parseInts(a); return { tensor: reshape(t, d), code: `.view(${d.join(', ')})` }; }
    case 'permute': { const d = parseInts(a); return { tensor: permute(t, d.map((v) => normDim(v, t.shape.length))), code: `.permute(${d.join(', ')})` }; }
    case 'transpose': { const d = parseInts(a); if (d.length !== 2) throw new Error('Give two dimensions, like 0, 1'); return { tensor: transpose(t, d[0], d[1]), code: `.transpose(${d[0]}, ${d[1]})` }; }
    case 'unsqueeze': { const d = one(a); return { tensor: unsqueeze(t, d), code: `.unsqueeze(${d})` }; }
    case 'squeeze': if (a) { const d = one(a); return { tensor: squeeze(t, d), code: `.squeeze(${d})` }; } return { tensor: squeeze(t), code: '.squeeze()' };
    case 'index': { if (!a) throw new Error('Type an index, like 0, : or 0:2, 1'); return { tensor: index(t, a), code: `[${a}]` }; }
    case 'sum': case 'mean': case 'max': case 'min': {
      const keep = /keep/i.test(a); const nums = a.replace(/keep\w*/i, '').trim();
      const d = nums ? one(nums) : undefined;
      const r = reduce(t, op, d, keep);
      const args = [d !== undefined ? `dim=${d}` : '', keep ? 'keepdim=True' : ''].filter(Boolean).join(', ');
      if (op === 'mean') return { tensor: r, code: `.float().mean(${args})` };
      return { tensor: r, code: `.${op}(${args})${(op === 'max' || op === 'min') && d !== undefined ? '.values' : ''}` };
    }
    case 'add': { const d = parseInts(a); const o = make(d); return { tensor: add(t, o), code: ` + torch.arange(${prod(d)}).reshape(${d.join(', ')})` }; }
    case 'matmul': { const d = parseInts(a); const o = make(d); return { tensor: matmul(t, o), code: ` @ torch.arange(${prod(d)}).reshape(${d.join(', ')})` }; }
    default: throw new Error(`unknown operation ${op}`);
  }
}

/** Run a whole chain. Returns {steps:[{tensor,code}|{error}], code}. Stops at the first error. */
export function runChain(baseShape, steps) {
  const out = []; let t = make(baseShape);
  let expr = 'x';
  const lines = ['import torch', '', `x = torch.arange(${prod(baseShape)}).reshape(${baseShape.join(', ')})`, 'print(x.shape)'];
  for (let i = 0; i < steps.length; i++) {
    try {
      const r = applyStep(t, steps[i]);
      t = r.tensor;
      const e = r.code.startsWith(' ') ? `(${expr})${r.code}` : `${expr}${r.code}`;
      out.push({ tensor: t, code: r.code });
      lines.push('', `y${i + 1} = ${e}`, `print("step ${i + 1}:", y${i + 1}.shape)`);
      expr = `y${i + 1}`;
    } catch (e) { out.push({ error: e.message }); break; }
  }
  return { steps: out, code: lines.join('\n') + '\n' };
}

export function format(t, maxItems = 60) {
  if (t.empty) return 'tensor([])';
  const fmt = (v) => (Number.isInteger(v) ? String(v) : Number(v.toFixed(3)).toString());
  if (!t.data) return '(values are not shown for batched matmul)';
  if (t.shape.length === 0) return fmt(t.data[0]);
  const st = stridesOf(t.shape);
  let shown = 0;
  const rec = (k, off) => {
    if (k === t.shape.length - 1) { const row = []; for (let i = 0; i < t.shape[k]; i++) { if (shown++ >= maxItems) { row.push('…'); break; } row.push(fmt(t.data[off + i])); } return `[${row.join(', ')}]`; }
    const rows = []; for (let i = 0; i < t.shape[k]; i++) { if (shown >= maxItems) { rows.push('…'); break; } rows.push(rec(k + 1, off + i * st[k])); }
    return `[${rows.join(',\n' + ' '.repeat(k + 1))}]`;
  };
  return rec(0, 0);
}
