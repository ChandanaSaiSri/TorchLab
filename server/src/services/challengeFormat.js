// Pure helpers (no database): parse challenge files, build the graded program, parse the results.
import crypto from 'node:crypto';

export const XP_BY_DIFFICULTY = { easy: 10, medium: 25, hard: 50, expert: 100 };
export const DIFFICULTIES = Object.keys(XP_BY_DIFFICULTY);

/**
 * Challenge file format:
 *   ---
 *   title: ...
 *   difficulty: easy|medium|hard|expert
 *   category: ...
 *   ---
 *   markdown description
 *   <!-- STARTER -->   code the learner starts with
 *   <!-- SOLUTION -->  reference solution (shown only after solving / giving up)
 *   <!-- HINTS -->     hints separated by a line containing only ===
 *   <!-- TESTS -->     python: functions test_* (visible) and hidden_* (hidden)
 */
export function parseChallenge(raw, fileName) {
  const text = raw.replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`Bad challenge front matter: ${fileName}`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  if (!DIFFICULTIES.includes(meta.difficulty)) throw new Error(`Bad difficulty in ${fileName}`);

  const sections = {};
  const parts = m[2].split(/<!-- (STARTER|SOLUTION|HINTS|TESTS) -->\n?/);
  const description = parts[0].trim();
  for (let i = 1; i < parts.length; i += 2) sections[parts[i]] = parts[i + 1];
  for (const k of ['STARTER', 'SOLUTION', 'HINTS', 'TESTS']) {
    if (sections[k] === undefined) throw new Error(`Missing ${k} in ${fileName}`);
  }
  return {
    slug: meta.slug || fileName.replace(/^\d+-/, '').replace(/\.md$/, ''),
    title: meta.title,
    difficulty: meta.difficulty,
    category: meta.category,
    xp: XP_BY_DIFFICULTY[meta.difficulty],
    description_md: description,
    starter_code: sections.STARTER.trim() + '\n',
    solution_code: sections.SOLUTION.trim() + '\n',
    hints: sections.HINTS.split(/\n===\n/).map((h) => h.trim()).filter(Boolean),
    tests: sections.TESTS.trim() + '\n',
  };
}

const HARNESS = `
def _tl_run():
    import json as _j, sys as _s
    _res = []
    for _n, _f in list(globals().items()):
        if callable(_f) and (_n.startswith("test_") or _n.startswith("hidden_")):
            _hid = _n.startswith("hidden_")
            try:
                _f()
                _res.append({"name": _n, "hidden": _hid, "passed": True})
            except Exception as _e:
                _res.append({"name": _n, "hidden": _hid, "passed": False,
                             "message": ("%s: %s" % (type(_e).__name__, _e))[:400]})
    _s.__stdout__.write("\\n@@TL_RESULT_NONCE@@" + _j.dumps(_res) + "\\n")
    _s.__stdout__.flush()
_tl_run()
`;

/** The program that is sent to the runner: user code, then tests, then the harness. */
export function composeProgram(userCode, testsCode, nonce) {
  const preamble = [
    'import re',
    'import torch',
    'import torch.nn.functional as F',
    'from torch import nn',
    `__source__ = ${JSON.stringify(userCode)}`,
  ].join('\n');
  return `${userCode}\n\n# ---- grader ----\n${preamble}\n${testsCode}\n${HARNESS.replaceAll('NONCE', nonce)}`;
}

export const newNonce = () => crypto.randomBytes(8).toString('hex');

/** Split the runner's stdout into what the learner printed and the structured test results. */
export function parseResults(stdout, nonce) {
  const marker = `@@TL_RESULT_${nonce}@@`;
  const idx = stdout.lastIndexOf(marker);
  if (idx === -1) return { tests: null, userStdout: stdout };
  const userStdout = stdout.slice(0, idx).replace(/\n$/, '');
  try {
    return { tests: JSON.parse(stdout.slice(idx + marker.length).trim()), userStdout };
  } catch {
    return { tests: null, userStdout: stdout };
  }
}

/** What the client may see: names + messages for visible tests, only counts for hidden ones. */
export function summarize(tests) {
  const visible = tests.filter((t) => !t.hidden).map((t) => ({ name: t.name, passed: t.passed, message: t.passed ? undefined : t.message }));
  const hidden = tests.filter((t) => t.hidden);
  return {
    visible,
    hidden: { total: hidden.length, passed: hidden.filter((t) => t.passed).length },
    passed: tests.length > 0 && tests.every((t) => t.passed),
    testsPassed: tests.filter((t) => t.passed).length,
    testsTotal: tests.length,
  };
}
