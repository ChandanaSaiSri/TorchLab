import { query } from '../db.js';
import { syncAchievements } from './achievements.js';

/** Mark today as an active learning day (idempotent). */
export async function recordActivity(userId) {
  await query(
    'INSERT INTO learning_streaks(user_id, day) VALUES ($1, CURRENT_DATE) ON CONFLICT DO NOTHING',
    [userId]
  );
  // Every learning action ends here, so this is the one place that checks badges and course certificates.
  try {
    await syncAchievements(userId);
  } catch (e) {
    console.error('achievement sync failed', e.message);
  }
}

/** Award XP once per (user, reason, ref). Returns true if newly awarded. */
export async function awardXp(userId, amount, reason, ref) {
  const r = await query(
    `INSERT INTO xp_transactions(user_id, amount, reason, ref)
     VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id`,
    [userId, amount, reason, String(ref)]
  );
  return r.rowCount > 0;
}

export async function totalXp(userId) {
  const r = await query('SELECT COALESCE(SUM(amount),0)::int AS xp FROM xp_transactions WHERE user_id=$1', [userId]);
  return r.rows[0].xp;
}

const DAY = 86400000;
const toMs = (s) => Date.parse(s + 'T00:00:00Z');

/** Current streak: consecutive active days ending today (or yesterday, so it survives until midnight). */
export async function getStreak(userId) {
  const r = await query(
    `SELECT to_char(day,'YYYY-MM-DD') AS day, to_char(CURRENT_DATE,'YYYY-MM-DD') AS today
     FROM learning_streaks WHERE user_id=$1 ORDER BY day DESC LIMIT 400`,
    [userId]
  );
  if (!r.rows.length) return { current: 0, activeToday: false };
  const today = toMs(r.rows[0].today);
  const days = r.rows.map((x) => toMs(x.day));
  const activeToday = days[0] === today;
  let expected = activeToday ? today : today - DAY;
  if (days[0] !== expected) return { current: 0, activeToday: false };
  let count = 0;
  for (const d of days) {
    if (d === expected) {
      count++;
      expected -= DAY;
    } else break;
  }
  return { current: count, activeToday };
}
