// Run with: node client/tests/sim.test.mjs   (no dependencies)
import assert from 'node:assert/strict';
import * as T from '../src/lib/tensorSim.js';
import { analyze, PRESETS, parseLayer } from '../src/lib/modelSim.js';

let n = 0; const ok = (name, fn) => { fn(); n++; console.log('ok', name); };
const x = T.make([2, 3, 4]);
ok('make', () => assert.deepEqual(x.shape, [2, 3, 4]));
ok('reshape -1', () => assert.deepEqual(T.reshape(x, [-1, 6]).shape, [4, 6]));
ok('reshape bad', () => assert.throws(() => T.reshape(x, [5, -1]), /invalid for input of size 24/));
ok('permute values', () => { const p = T.permute(x, [2, 0, 1]); assert.deepEqual(p.shape, [4, 2, 3]); assert.equal(p.data[1], 4); assert.equal(p.data[3], 12); });
ok('transpose 2d', () => assert.deepEqual(T.transpose(T.make([2, 3]), 0, 1).data, [0, 3, 1, 4, 2, 5]));
ok('unsqueeze/squeeze', () => { assert.deepEqual(T.unsqueeze(x, 0).shape, [1, 2, 3, 4]); assert.deepEqual(T.unsqueeze(x, -1).shape, [2, 3, 4, 1]); assert.deepEqual(T.squeeze(T.unsqueeze(x, 1)).shape, [2, 3, 4]); });
ok('index', () => { assert.deepEqual(T.index(x, '0').shape, [3, 4]); assert.deepEqual(T.index(x, ':, 1:3, ::2').shape, [2, 2, 2]); assert.deepEqual(T.index(x, '1, -1, -1').data, [23]); assert.throws(() => T.index(x, '2'), /out of bounds/); });
ok('reduce', () => { assert.deepEqual(T.reduce(x, 'sum', 0).shape, [3, 4]); assert.deepEqual(T.reduce(x, 'sum', 2, true).shape, [2, 3, 1]); assert.equal(T.reduce(T.make([2, 2]), 'sum').data[0], 6); assert.deepEqual(T.reduce(T.make([2, 3]), 'sum', 1).data, [3, 12]); });
ok('broadcast', () => { assert.deepEqual(T.broadcastShapes([3, 1], [1, 4]), [3, 4]); assert.throws(() => T.broadcastShapes([3], [4]), /must match/); const r = T.add(T.make([2, 1]), T.make([3])); assert.deepEqual(r.shape, [2, 3]); assert.deepEqual(r.data, [0, 1, 2, 1, 2, 3]); });
ok('matmul', () => { assert.deepEqual(T.matmul(T.make([2, 3]), T.make([3, 2])).data, [10, 13, 28, 40]); assert.throws(() => T.matmul(T.make([2, 3]), T.make([2, 3])), /cannot be multiplied/); assert.deepEqual(T.matmulShape([5, 2, 3], [3, 4]), [5, 2, 4]); assert.deepEqual(T.matmulShape([3], [3]), []); });
ok('chain', () => { const r = T.runChain([2, 3], [{ op: 'transpose', arg: '0, 1' }, { op: 'reshape', arg: '-1' }, { op: 'sum', arg: '0' }]); assert.equal(r.steps.length, 3); assert.deepEqual(r.steps[1].tensor.shape, [6]); assert.match(r.code, /y3 = y2\.sum\(dim=0\)/); });
ok('chain stops on error', () => { const r = T.runChain([2, 3], [{ op: 'reshape', arg: '4, 4' }, { op: 'sum', arg: '' }]); assert.equal(r.steps.length, 1); assert.ok(r.steps[0].error); });
ok('chain add', () => { const r = T.runChain([2, 1], [{ op: 'add', arg: '3' }]); assert.deepEqual(r.steps[0].tensor.shape, [2, 3]); assert.match(r.code, /torch\.arange\(3\)\.reshape\(3\)/); });
ok('format', () => assert.match(T.format(T.make([2, 2])), /\[\[0, 1\],\n \[2, 3\]\]/));

ok('parse layer', () => { const l = parseLayer('nn.Conv2d(1, 6, 5, padding=(2, 2)),'); assert.equal(l.args.in_channels, 1); assert.deepEqual(l.args.padding, [2, 2]); });
ok('lenet params', () => { const r = analyze(PRESETS['LeNet-5'].layers, PRESETS['LeNet-5'].input); assert.equal(r.error, null); assert.equal(r.total, 61706); assert.deepEqual(r.outShape, [10]); assert.deepEqual(r.rows[0].shape, [6, 28, 28]); assert.deepEqual(r.rows[3].shape, [16, 10, 10]); });
ok('mlp params', () => assert.equal(analyze(PRESETS['Simple MLP'].layers, [784]).total, 784 * 128 + 128 + 128 * 64 + 64 + 64 * 10 + 10));
ok('cifar cnn', () => { const r = analyze(PRESETS['Small CNN (CIFAR)'].layers, [3, 32, 32]); assert.equal(r.error, null); assert.deepEqual(r.outShape, [10]); assert.equal(r.total, 448 + 32 + 4640 + 64 + 330); });
ok('mismatch flagged', () => { const r = analyze(PRESETS['Broken example'].layers, [1, 28, 28]); assert.match(r.error, /Linear expects 400 input features but gets 864/); assert.equal(r.rows.at(-1).error, r.error); });
ok('unsupported layer', () => assert.match(analyze('LSTM(3, 4)', [3]).error, /isn't supported/));
ok('unreadable', () => assert.match(analyze('hello', [3]).error, /can't read/));
ok('channels mismatch', () => assert.match(analyze('Conv2d(3, 8, 3)', [1, 8, 8]).error, /expects 3 input channels but gets 1/));
ok('kernel too big', () => assert.match(analyze('Conv2d(1, 8, 9)', [1, 8, 8]).error, /doesn't fit/));
ok('sequential wrapper ignored', () => assert.equal(analyze('model = nn.Sequential(\n nn.Linear(2, 3),\n nn.ReLU(),\n)', [2]).total, 9));
console.log(`\n${n} checks passed`);
