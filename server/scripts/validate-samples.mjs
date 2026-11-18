// Runs every Playground sample through the code runner and fails if any breaks.
// Usage: RUNNER_URL=http://localhost:8000 node scripts/validate-samples.mjs   (the runner must be up)
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { composeCells } from '../src/services/notebookRunner.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '../../client/src/data/samples.js'), 'utf8').replace('export const SAMPLES', 'globalThis.SAMPLES');
(0, eval)(src);
const url = process.env.RUNNER_URL || 'http://localhost:8000';
let bad = 0;
for (const s of globalThis.SAMPLES) {
  const code = s.kind === 'notebook' ? composeCells(s.cells, s.cells.length - 1).program : s.code;
  const r = await fetch(`${url}/run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, files: {}, data: {} }) }).then((x) => x.json());
  const ok = r.status === 'success';
  if (!ok) bad++;
  console.log(ok ? 'ok  ' : 'FAIL', s.id, ok ? '' : (r.stderr || '').slice(-300));
}
console.log(bad ? `${bad} sample(s) failed` : 'all samples run');
process.exit(bad ? 1 : 0);
