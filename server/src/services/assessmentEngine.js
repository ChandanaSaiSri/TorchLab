// Pure assessment logic (no database, no network): drawing a paper, scoring answers, combining sections.
import crypto from 'node:crypto';

export const WEIGHTS = { theory: 20, coding: 30, practical: 50 };
export const SECTION_ORDER = ['theory', 'coding', 'practical'];

const defaultRnd = () => crypto.randomInt(0, 2 ** 31) / 2 ** 31;

export function shuffle(arr, rnd = defaultRnd) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Draw a random paper. `config.sections` = [{ name, pick, tags? }]; questions are chosen at random from the
 * matching pool and, for choice questions, the options are shuffled. The result is stored with the attempt so that
 * grading and resuming always see exactly the paper the learner was given.
 */
export function buildLayout(config, bank, rnd = defaultRnd) {
  const layout = [];
  const used = new Set();
  for (const sec of config.sections) {
    const pool = bank.filter(
      (q) => q.section === sec.name && q.published !== false && !used.has(q.qid) &&
        (!sec.tags?.length || q.tags.some((t) => sec.tags.includes(t)))
    );
    for (const q of shuffle(pool, rnd).slice(0, sec.pick)) {
      used.add(q.qid);
      const n = q.data.options?.length;
      layout.push({ qid: q.qid, order: n ? shuffle([...Array(n).keys()], rnd) : null });
    }
  }
  return layout;
}

/** What the learner sees while taking the test (never the answers). */
export function publicQuestion(q, item) {
  const base = { qid: q.qid, section: q.section, type: q.type, points: q.data.points ?? 1 };
  if (q.type === 'code') return { ...base, title: q.data.title, prompt: q.data.prompt, starter: q.data.starter };
  return { ...base, prompt: q.data.prompt, options: item.order.map((i) => q.data.options[i]) };
}

/** Single choice. `answer` is the DISPLAYED option index (or null). */
export function scoreMcq(q, item, answer, negative = 0) {
  const points = q.data.points ?? 1;
  if (answer === null || answer === undefined) return { earned: 0, possible: points, status: 'unanswered' };
  const correct = item.order[answer] === q.data.answer;
  return correct
    ? { earned: points, possible: points, status: 'correct' }
    : { earned: negative ? -negative * points : 0, possible: points, status: 'wrong' };
}

/** Multiple select with partial credit: (right picks - wrong picks) / number of right options, never below 0. */
export function scoreMulti(q, item, answer) {
  const points = q.data.points ?? 2;
  if (!Array.isArray(answer) || answer.length === 0) return { earned: 0, possible: points, status: 'unanswered' };
  const selected = new Set(answer.map((d) => item.order[d]));
  const right = new Set(q.data.answers);
  let c = 0;
  let w = 0;
  for (const s of selected) (right.has(s) ? c++ : w++);
  const frac = Math.max(0, (c - w) / right.size);
  const status = frac === 1 && w === 0 ? 'correct' : frac > 0 ? 'partial' : 'wrong';
  return { earned: +(points * frac).toFixed(4), possible: points, status };
}

export function reviewChoice(q, item, answer) {
  const selected = new Set(q.type === 'multi' ? (answer || []).map((d) => item.order[d]) : answer == null ? [] : [item.order[answer]]);
  const right = new Set(q.type === 'multi' ? q.data.answers : [q.data.answer]);
  return {
    options: item.order.map((i) => ({ text: q.data.options[i], correct: right.has(i), selected: selected.has(i) })),
    explain: q.data.explain,
  };
}

/** Section totals (never below zero) and the weighted overall percentage over the sections that are present. */
export function combine(questionResults, weights = WEIGHTS) {
  const sections = {};
  for (const r of questionResults) {
    const s = (sections[r.section] ??= { earned: 0, possible: 0 });
    s.earned += r.earned;
    s.possible += r.possible;
  }
  let weighted = 0;
  let weightSum = 0;
  for (const [name, s] of Object.entries(sections)) {
    s.earned = Math.max(0, +s.earned.toFixed(4));
    s.percent = s.possible > 0 ? +((s.earned / s.possible) * 100).toFixed(2) : 0;
    s.weight = weights[name] ?? 0;
    if (s.possible > 0) {
      weighted += s.weight * s.percent;
      weightSum += s.weight;
    }
  }
  return { sections, percent: weightSum ? +(weighted / weightSum).toFixed(2) : 0 };
}
