// Validation for content created or edited in the admin UI. Pure helpers plus one runner-backed check.
import { composeProgram, newNonce, parseResults } from './challengeFormat.js';
import { runProgram } from './runner.js';

export class ValidationError extends Error {}
const fail = (msg) => { throw new ValidationError(msg); };

export const slugify = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export function checkQuiz(quiz) {
  if (!Array.isArray(quiz)) fail('Quiz must be a list of questions');
  if (quiz.length > 20) fail('A lesson can have at most 20 quiz questions');
  quiz.forEach((q, i) => {
    const n = `Quiz question ${i + 1}`;
    if (!q || typeof q.q !== 'string' || !q.q.trim()) fail(`${n}: the question text is missing`);
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 8 || q.options.some((o) => typeof o !== 'string' || !o.trim())) fail(`${n}: needs 2 to 8 non-empty options`);
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) fail(`${n}: the correct answer must be one of the options`);
  });
  return quiz.map((q) => ({ q: q.q.trim(), options: q.options.map((o) => o.trim()), answer: q.answer, explain: String(q.explain || '').trim() }));
}

/** Shape check for an assessment question's `data` by type. Returns the cleaned object. */
export function checkQuestionData(type, d) {
  if (!d || typeof d !== 'object') fail('Question data is missing');
  if (typeof d.prompt !== 'string' || !d.prompt.trim()) fail('The question needs a prompt');
  const points = Number(d.points ?? 1);
  if (!Number.isInteger(points) || points < 1 || points > 20) fail('Points must be a whole number from 1 to 20');
  const base = { prompt: d.prompt.trim(), explain: String(d.explain || '').trim(), points };
  if (type === 'mcq' || type === 'multi') {
    if (!Array.isArray(d.options) || d.options.length < 2 || d.options.length > 8 || d.options.some((o) => typeof o !== 'string' || !o.trim())) fail('Needs 2 to 8 non-empty options');
    const options = d.options.map((o) => o.trim());
    const okIdx = (v) => Number.isInteger(v) && v >= 0 && v < options.length;
    if (type === 'mcq') {
      if (!okIdx(d.answer)) fail('Pick the correct option');
      return { ...base, options, answer: d.answer };
    }
    if (!Array.isArray(d.answers) || d.answers.length < 1 || !d.answers.every(okIdx) || new Set(d.answers).size !== d.answers.length) fail('Pick at least one correct option');
    return { ...base, options, answers: [...d.answers].sort((a, b) => a - b) };
  }
  if (type === 'code') {
    for (const k of ['title', 'starter', 'solution', 'tests']) if (typeof d[k] !== 'string' || !d[k].trim()) fail(`Coding questions need: ${k}`);
    return { ...base, title: d.title.trim(), starter: d.starter, solution: d.solution, tests: d.tests };
  }
  return fail('Unknown question type');
}

/**
 * Run the author's own reference solution and starter against the tests.
 * A good exercise: the solution passes every test and the untouched starter does not.
 * Throws ValidationError with a specific reason; RunnerError (from the runner) is left to the caller.
 */
export async function checkExercise({ starter, solution, tests }) {
  if (!/^def (test_|hidden_)\w+\(/m.test(tests)) fail('Tests must define at least one function named test_… or hidden_…');
  const run = async (code) => {
    const nonce = newNonce();
    const out = await runProgram(composeProgram(code, tests, nonce));
    const { tests: results } = parseResults(out.stdout || '', nonce);
    return { results, out };
  };
  const sol = await run(solution);
  if (!sol.results) fail(`The tests did not finish with the reference solution. ${(sol.out.stderr || '').trim().split('\n').slice(-3).join(' ')}`.trim());
  const bad = sol.results.filter((t) => !t.passed);
  if (bad.length) fail(`The reference solution fails ${bad.length} of ${sol.results.length} tests (first: ${bad[0].name}: ${bad[0].message || 'failed'})`);
  const st = await run(starter);
  if (st.results && st.results.length && st.results.every((t) => t.passed)) fail('The starter code already passes every test. It should need work.');
  return { tests: sol.results.length, hidden: sol.results.filter((t) => t.hidden).length };
}
