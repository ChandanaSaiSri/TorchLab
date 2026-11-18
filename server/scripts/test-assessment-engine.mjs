// Quick self-checks for the scoring rules: node scripts/test-assessment-engine.mjs
import assert from 'node:assert/strict';
import { buildLayout, scoreMcq, scoreMulti, combine, publicQuestion, shuffle } from '../src/services/assessmentEngine.js';

const mcq = { qid: 'a', section: 'theory', type: 'mcq', tags: ['x'], data: { prompt: '?', options: ['A', 'B', 'C', 'D'], answer: 2, points: 1 } };
const multi = { qid: 'b', section: 'theory', type: 'multi', tags: ['x'], data: { prompt: '?', options: ['A', 'B', 'C', 'D'], answers: [0, 1], points: 2 } };
const ident = { order: [0, 1, 2, 3] };
const flipped = { order: [3, 2, 1, 0] };       // displayed 0 -> original 3 ...

// single choice
assert.deepEqual(scoreMcq(mcq, ident, 2), { earned: 1, possible: 1, status: 'correct' });
assert.equal(scoreMcq(mcq, ident, 1).earned, 0);
assert.equal(scoreMcq(mcq, ident, 1, 0.25).earned, -0.25);
assert.equal(scoreMcq(mcq, ident, null, 0.25).earned, 0);                // skipping is free
assert.equal(scoreMcq(mcq, flipped, 1).status, 'correct');               // displayed 1 -> original 2
// multi select, partial credit
assert.equal(scoreMulti(multi, ident, [0, 1]).status, 'correct');
assert.equal(scoreMulti(multi, ident, [0]).earned, 1);                   // half of the right ones
assert.equal(scoreMulti(multi, ident, [0, 1, 2]).earned, 1);             // 2 right - 1 wrong = 1/2
assert.equal(scoreMulti(multi, ident, [2, 3]).earned, 0);                // never negative
assert.equal(scoreMulti(multi, flipped, [3, 2]).status, 'correct');      // displayed 3,2 -> original 0,1
// combining: theory 80%, coding 50% -> (20*80 + 30*50) / 50 = 62
const c = combine([
  { section: 'theory', earned: 8, possible: 10 },
  { section: 'coding', earned: 5, possible: 10 },
]);
assert.equal(c.percent, 62);
// all three sections 20/30/50
assert.equal(combine([
  { section: 'theory', earned: 10, possible: 10 },
  { section: 'coding', earned: 0, possible: 10 },
  { section: 'practical', earned: 10, possible: 10 },
]).percent, 70);
// negative marks cannot push a section below zero
assert.equal(combine([{ section: 'theory', earned: -2, possible: 4 }]).sections.theory.earned, 0);

// drawing a paper
const bank = Array.from({ length: 20 }, (_, i) => ({ ...mcq, qid: `q${i}`, tags: ['x'] }));
const l1 = buildLayout({ sections: [{ name: 'theory', pick: 5, tags: ['x'] }] }, bank);
assert.equal(l1.length, 5);
assert.equal(new Set(l1.map((i) => i.qid)).size, 5);
assert.ok(l1.every((i) => [...i.order].sort().join() === '0,1,2,3'));
const many = new Set(Array.from({ length: 20 }, () => buildLayout({ sections: [{ name: 'theory', pick: 5 }] }, bank).map((i) => i.qid).join()));
assert.ok(many.size > 5, 'papers should differ between attempts');
assert.equal(buildLayout({ sections: [{ name: 'theory', pick: 5, tags: ['nope'] }] }, bank).length, 0);
assert.ok(!('answer' in publicQuestion(mcq, ident)), 'answers must not leak to the client');
assert.equal(shuffle([1, 2, 3, 4], () => 0.5).length, 4);
console.log('assessment engine: all checks passed');
