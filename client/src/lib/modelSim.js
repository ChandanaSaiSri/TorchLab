// Shape and parameter calculator for nn.Sequential-style layer lists. Pure JS.
const ACTS = ['ReLU', 'Sigmoid', 'Tanh', 'GELU', 'LeakyReLU', 'ELU', 'SiLU', 'Softmax', 'LogSoftmax', 'Softplus'];
const IDENT = ['Dropout', 'Dropout2d', 'Identity'];
const SPEC = {
  Linear: ['in_features', 'out_features', 'bias'],
  Conv2d: ['in_channels', 'out_channels', 'kernel_size', 'stride', 'padding', 'dilation', 'groups', 'bias'],
  MaxPool2d: ['kernel_size', 'stride', 'padding'],
  AvgPool2d: ['kernel_size', 'stride', 'padding'],
  AdaptiveAvgPool2d: ['output_size'],
  BatchNorm2d: ['num_features'],
  BatchNorm1d: ['num_features'],
  Flatten: ['start_dim', 'end_dim'],
};
export const SUPPORTED = [...Object.keys(SPEC), ...ACTS, ...IDENT];

function splitTop(s) {
  const out = []; let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function value(raw) {
  const s = raw.trim();
  if (/^(True|False)$/.test(s)) return s === 'True';
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (/^[(\[]/.test(s)) return splitTop(s.slice(1, -1)).map(value);
  if (s === 'None') return null;
  return s;
}

/** "Conv2d(1, 6, 5, padding=2)" -> {name, args:{in_channels:1,...}} */
export function parseLayer(line) {
  const t = line.trim().replace(/,$/, '').replace(/^nn\./, '');
  const m = t.match(/^(\w+)\s*\((.*)\)$/s);
  if (!m) throw new Error(`I can't read "${line.trim()}". Write layers like Linear(10, 5) or ReLU()`);
  const [, name, inner] = m;
  if (!SUPPORTED.includes(name)) throw new Error(`${name} isn't supported here yet. Supported: ${SUPPORTED.join(', ')}`);
  const names = SPEC[name] || [];
  const args = {};
  let pos = 0;
  for (const part of splitTop(inner)) {
    const kw = part.match(/^(\w+)\s*=\s*(.*)$/s);
    if (kw) args[kw[1]] = value(kw[2]);
    else { if (names.length && pos >= names.length) throw new Error(`${name} takes at most ${names.length} arguments`); args[names[pos++] ?? `arg${pos}`] = value(part); }
  }
  return { name, args, text: `${name}(${inner.trim()})` };
}

const pair = (v, d) => (Array.isArray(v) ? [v[0], v[1] ?? v[0]] : [v ?? d, v ?? d]);
const need = (l, k) => { if (l.args[k] === undefined) throw new Error(`${l.name} needs ${k}`); return l.args[k]; };
const fmtShape = (s) => `(${s.join(', ')})`;

function step(l, shape) {
  const n = l.name, a = l.args;
  if (ACTS.includes(n) || IDENT.includes(n)) return { shape, params: 0 };
  if (n === 'Linear') {
    const i = need(l, 'in_features'), o = need(l, 'out_features');
    if (shape[shape.length - 1] !== i) throw new Error(`Linear expects ${i} input features but gets ${shape[shape.length - 1]} (input shape ${fmtShape(shape)}).${shape.length > 1 ? ' Add Flatten() before it.' : ''}`);
    return { shape: [...shape.slice(0, -1), o], params: i * o + (a.bias === false ? 0 : o) };
  }
  if (['Conv2d', 'MaxPool2d', 'AvgPool2d', 'AdaptiveAvgPool2d', 'BatchNorm2d'].includes(n) && shape.length !== 3) throw new Error(`${n} needs a 3-number image shape (channels, height, width) but gets ${fmtShape(shape)}`);
  if (n === 'Conv2d') {
    const i = need(l, 'in_channels'), o = need(l, 'out_channels');
    const [kh, kw] = pair(need(l, 'kernel_size')), [sh, sw] = pair(a.stride, 1), [ph, pw] = pair(a.padding, 0), [dh, dw] = pair(a.dilation, 1);
    const g = a.groups ?? 1;
    if (shape[0] !== i) throw new Error(`Conv2d expects ${i} input channels but gets ${shape[0]} (input shape ${fmtShape(shape)})`);
    if (i % g || o % g) throw new Error('in_channels and out_channels must both be divisible by groups');
    const H = Math.floor((shape[1] + 2 * ph - dh * (kh - 1) - 1) / sh) + 1, W = Math.floor((shape[2] + 2 * pw - dw * (kw - 1) - 1) / sw) + 1;
    if (H < 1 || W < 1) throw new Error(`The ${kh}x${kw} kernel doesn't fit in a ${shape[1]}x${shape[2]} image — the output would be empty`);
    return { shape: [o, H, W], params: o * (i / g) * kh * kw + (a.bias === false ? 0 : o) };
  }
  if (n === 'MaxPool2d' || n === 'AvgPool2d') {
    const k = need(l, 'kernel_size');
    const [kh, kw] = pair(k), [sh, sw] = pair(a.stride ?? k), [ph, pw] = pair(a.padding, 0);
    const H = Math.floor((shape[1] + 2 * ph - kh) / sh) + 1, W = Math.floor((shape[2] + 2 * pw - kw) / sw) + 1;
    if (H < 1 || W < 1) throw new Error(`The ${kh}x${kw} window doesn't fit in a ${shape[1]}x${shape[2]} image`);
    return { shape: [shape[0], H, W], params: 0 };
  }
  if (n === 'AdaptiveAvgPool2d') { const [h, w] = pair(need(l, 'output_size')); return { shape: [shape[0], h, w], params: 0 }; }
  if (n === 'BatchNorm2d') {
    const f = need(l, 'num_features');
    if (shape[0] !== f) throw new Error(`BatchNorm2d expects ${f} channels but gets ${shape[0]}`);
    return { shape, params: 2 * f };
  }
  if (n === 'BatchNorm1d') {
    const f = need(l, 'num_features');
    if (shape[0] !== f) throw new Error(`BatchNorm1d expects ${f} features but gets ${shape[0]} (input shape ${fmtShape(shape)})`);
    return { shape, params: 2 * f };
  }
  if (n === 'Flatten') return { shape: [shape.reduce((x, y) => x * y, 1)], params: 0 };
  throw new Error(`${n} isn't supported`);
}

/** Returns {rows, total, error, outShape}. Shapes exclude the batch dimension. */
export function analyze(source, inputShape) {
  const lines = source.split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#') && !/^(model\s*=\s*)?(nn\.)?Sequential\(\s*$/.test(s) && s !== ')' && s !== '),');
  const rows = []; let shape = inputShape, total = 0, error = null;
  for (const line of lines) {
    let l;
    try { l = parseLayer(line); } catch (e) { rows.push({ text: line, error: e.message }); error = e.message; break; }
    try { const r = step(l, shape); rows.push({ text: l.text, name: l.name, inShape: shape, shape: r.shape, params: r.params }); shape = r.shape; total += r.params; }
    catch (e) { rows.push({ text: l.text, name: l.name, inShape: shape, error: e.message }); error = e.message; break; }
  }
  return { rows, total, error, outShape: error ? null : shape };
}

export function toCode(rows, inputShape) {
  const body = rows.filter((r) => !r.error).map((r) => `    nn.${r.text},`).join('\n');
  return `import torch\nfrom torch import nn\n\nmodel = nn.Sequential(\n${body}\n)\n\nx = torch.randn(1, ${inputShape.join(', ')})\nprint(model(x).shape)\nprint(sum(p.numel() for p in model.parameters()), "parameters")\n`;
}

export const PRESETS = {
  'LeNet-5': { input: [1, 28, 28], layers: 'Conv2d(1, 6, 5, padding=2)\nReLU()\nMaxPool2d(2)\nConv2d(6, 16, 5)\nReLU()\nMaxPool2d(2)\nFlatten()\nLinear(400, 120)\nReLU()\nLinear(120, 84)\nReLU()\nLinear(84, 10)' },
  'Simple MLP': { input: [784], layers: 'Linear(784, 128)\nReLU()\nDropout(0.2)\nLinear(128, 64)\nReLU()\nLinear(64, 10)' },
  'Small CNN (CIFAR)': { input: [3, 32, 32], layers: 'Conv2d(3, 16, 3, padding=1)\nBatchNorm2d(16)\nReLU()\nMaxPool2d(2)\nConv2d(16, 32, 3, padding=1)\nBatchNorm2d(32)\nReLU()\nMaxPool2d(2)\nAdaptiveAvgPool2d(1)\nFlatten()\nLinear(32, 10)' },
  'Broken example': { input: [1, 28, 28], layers: 'Conv2d(1, 6, 5)\nReLU()\nMaxPool2d(2)\nFlatten()\nLinear(400, 10)' },
};
