// Checks every challenge in server/challenges against a running runner:
//   - the starter code must NOT pass,
//   - the reference solution MUST pass every test.
// Usage: RUNNER_URL=http://localhost:8000 node scripts/validate-challenges.mjs [slug]
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseChallenge, composeProgram, newNonce, parseResults, summarize } from '../src/services/challengeFormat.js';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../challenges');
const RUNNER = process.env.RUNNER_URL || 'http://localhost:8000';
const only = process.argv[2];

async function grade(code, tests) {
  const nonce = newNonce();
  const r = await fetch(`${RUNNER}/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: composeProgram(code, tests, nonce) }),
  });
  const out = await r.json();
  const { tests: results } = parseResults(out.stdout, nonce);
  return { out, results };
}

let bad = 0;
const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.md')).sort();
for (const f of files) {
  const c = parseChallenge(await fs.readFile(path.join(dir, f), 'utf8'), f);
  if (only && c.slug !== only) continue;
  const sol = await grade(c.solution_code, c.tests);
  const st = await grade(c.starter_code, c.tests);
  const solOk = sol.results && summarize(sol.results).passed;
  const starterFails = !st.results || !summarize(st.results).passed;
  const line = `${solOk && starterFails ? 'OK  ' : 'FAIL'} ${c.difficulty.padEnd(6)} ${c.slug} (${sol.out.runtime_ms} ms)`;
  console.log(line);
  if (!solOk) {
    bad++;
    console.log('   solution did not pass:', sol.results ? JSON.stringify(sol.results.filter((t) => !t.passed)) : sol.out.stderr.slice(-600));
  }
  if (!starterFails) {
    bad++;
    console.log('   starter unexpectedly passes all tests');
  }
}

// ---------------------------------------------------------------- assessment question bank
if (!only) {
  const adir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assessments');
  const bank = [];
  for (const f of (await fs.readdir(path.join(adir, 'questions'))).filter((x) => x.endsWith('.json')).sort()) {
    bank.push(...JSON.parse(await fs.readFile(path.join(adir, 'questions', f), 'utf8')));
  }
  const ids = new Set();
  for (const q of bank) {
    const problems = [];
    if (ids.has(q.qid)) problems.push('duplicate qid');
    ids.add(q.qid);
    if (!q.tags?.length) problems.push('no tags');
    if (q.type === 'mcq') {
      if (!(q.data.options.length >= 2 && Number.isInteger(q.data.answer) && q.data.answer >= 0 && q.data.answer < q.data.options.length)) problems.push('bad answer index');
      if (new Set(q.data.options).size !== q.data.options.length) problems.push('duplicate options');
    } else if (q.type === 'multi') {
      if (!q.data.answers?.length || !q.data.answers.every((i) => i >= 0 && i < q.data.options.length)) problems.push('bad answers');
    } else if (q.type === 'code') {
      const sol = await grade(q.data.solution, q.data.tests);
      const st = await grade(q.data.starter, q.data.tests);
      if (!(sol.results && summarize(sol.results).passed)) problems.push('solution does not pass: ' + (sol.results ? JSON.stringify(sol.results.filter((t) => !t.passed)) : sol.out.stderr.slice(-400)));
      if (st.results && summarize(st.results).passed) problems.push('starter passes all tests');
      console.log(`${problems.length ? 'FAIL' : 'OK  '} ${q.section.padEnd(9)} ${q.qid} (${sol.out.runtime_ms} ms)`);
    }
    if (problems.length) {
      bad++;
      console.log(`FAIL ${q.qid}: ${problems.join('; ')}`);
    }
  }
  console.log(`checked ${bank.length} assessment questions`);
  for (const f of (await fs.readdir(adir)).filter((x) => x.endsWith('.json')).sort()) {
    const a = JSON.parse(await fs.readFile(path.join(adir, f), 'utf8'));
    for (const s of a.config.sections) {
      const pool = bank.filter((q) => q.section === s.name && (!s.tags?.length || q.tags.some((x) => s.tags.includes(x)))).length;
      const ok = pool >= s.pick;
      if (!ok) bad++;
      console.log(`${ok ? 'OK  ' : 'FAIL'} ${a.slug}: ${s.name} picks ${s.pick} of a pool of ${pool}`);
    }
  }
}
console.log(bad ? `\n${bad} problem(s)` : `\nEverything valid`);
process.exit(bad ? 1 : 0);
