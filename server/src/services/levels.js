// Learner level is derived from total XP, so it can never get out of sync with progress.
export const LEVELS = [
  { name: 'Beginner', min: 0 },
  { name: 'Learner', min: 250 },
  { name: 'Practitioner', min: 750 },
  { name: 'Advanced', min: 1500 },
  { name: 'Expert', min: 3000 },
];

export function levelFor(xp) {
  let idx = 0;
  LEVELS.forEach((l, i) => { if (xp >= l.min) idx = i; });
  const cur = LEVELS[idx];
  const next = LEVELS[idx + 1] || null;
  return {
    name: cur.name,
    index: idx + 1,
    xp,
    nextName: next?.name || null,
    nextAt: next?.min ?? null,
    progress: next ? (xp - cur.min) / (next.min - cur.min) : 1,
  };
}
