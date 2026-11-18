// Checks every project in server/projects against a running runner. For each milestone k:
//   - the reference solutions of milestones 1..k, joined, must pass milestone k's tests,
//   - the starters of 1..k, joined, must NOT pass them.
// Usage: RUNNER_URL=http://localhost:8000 node scripts/validate-projects.mjs [project-slug]
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { composeProgram, newNonce, parseResults, summarize } from '../src/services/challengeFormat.js';
import { loadProject, joinCode } from '../src/services/projectFormat.js';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../projects');
const RUNNER = process.env.RUNNER_URL || 'http://localhost:8000';
const only = process.argv[2];

async function grade(code, tests, files) {
  const nonce = newNonce();
  const r = await fetch(`${RUNNER}/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: composeProgram(code, tests, nonce), files }),
  });
  if (!r.ok) throw new Error(`runner ${r.status}: ${await r.text()}`);
  const out = await r.json();
  return { out, results: parseResults(out.stdout, nonce).tests };
}

let bad = 0;
for (const folder of (await fs.readdir(dir)).sort()) {
  const p = await loadProject(path.join(dir, folder), folder);
  if (only && p.slug !== only) continue;
  console.log(`${p.title} (${p.level}, ${p.milestones.length} milestones)`);
  for (const [k, m] of p.milestones.entries()) {
    const sol = await grade(joinCode(p.milestones.slice(0, k + 1).map((x) => x.solution_code)), m.tests, p.files);
    const st = await grade(joinCode(p.milestones.slice(0, k + 1).map((x) => x.starter_code)), m.tests, p.files);
    const solOk = sol.results && summarize(sol.results).passed;
    const starterFails = !st.results || !summarize(st.results).passed;
    console.log(`  ${solOk && starterFails ? 'OK  ' : 'FAIL'} ${String(m.position)}. ${m.slug} (${sol.out.runtime_ms} ms)`);
    if (!solOk) {
      bad++;
      console.log('     solution did not pass:', sol.results ? JSON.stringify(sol.results.filter((t) => !t.passed)) : sol.out.stderr.slice(-800));
    }
    if (!starterFails) {
      bad++;
      console.log('     starter unexpectedly passes all tests');
    }
  }
}
console.log(bad ? `\n${bad} problem(s)` : '\nAll projects valid');
process.exit(bad ? 1 : 0);
