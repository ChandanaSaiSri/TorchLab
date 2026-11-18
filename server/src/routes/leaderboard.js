import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

const PERIOD_START = {
  weekly: "date_trunc('week', now())",
  monthly: "date_trunc('month', now())",
  all: "'-infinity'::timestamptz",
};
const MAX_TEAM_SIZE = 50;
const TOP = 25;

/** XP per learner for a period, ranked. Learners who opted out of the leaderboard are left out (but still see their own rank). */
async function ranking(period, teamId) {
  const { rows } = await query(
    `SELECT u.id, u.name, COALESCE(p.show_on_leaderboard, TRUE) AS visible, SUM(x.amount)::int AS xp
     FROM xp_transactions x
     JOIN users u ON u.id = x.user_id
     LEFT JOIN user_profiles p ON p.user_id = u.id
     ${teamId ? 'JOIN team_members tm ON tm.user_id = u.id AND tm.team_id = $1' : ''}
     WHERE x.created_at >= ${PERIOD_START[period]}
     GROUP BY u.id, u.name, p.show_on_leaderboard
     HAVING SUM(x.amount) > 0
     ORDER BY xp DESC, u.id ASC`,
    teamId ? [teamId] : []
  );
  return rows;
}

router.get('/', async (req, res) => {
  const period = PERIOD_START[req.query.period] ? req.query.period : 'weekly';
  const scope = req.query.scope === 'team' ? 'team' : 'global';
  let teamId = null;
  if (scope === 'team') {
    const t = await query('SELECT team_id FROM team_members WHERE user_id=$1', [req.user.id]);
    if (!t.rows[0]) return res.json({ period, scope, entries: [], me: null, noTeam: true });
    teamId = t.rows[0].team_id;
  }
  const all = await ranking(period, teamId);
  const ranked = all.map((r, i) => ({ rank: i + 1, ...r }));
  const entries = ranked.filter((r) => r.visible).slice(0, TOP).map((r) => ({ rank: r.rank, id: r.id, name: r.name, xp: r.xp, isMe: r.id === req.user.id }));
  const mine = ranked.find((r) => r.id === req.user.id);
  const vis = await query('SELECT COALESCE(show_on_leaderboard, TRUE) AS v FROM user_profiles WHERE user_id=$1', [req.user.id]);
  res.json({
    period, scope, entries,
    me: { rank: mine?.rank ?? null, xp: mine?.xp ?? 0, visible: vis.rows[0] ? vis.rows[0].v : true },
    total: ranked.length,
  });
});

router.put('/visibility', async (req, res) => {
  const visible = req.body?.visible !== false;
  await query(
    `INSERT INTO user_profiles(user_id, show_on_leaderboard) VALUES ($1,$2)
     ON CONFLICT (user_id) DO UPDATE SET show_on_leaderboard=EXCLUDED.show_on_leaderboard`,
    [req.user.id, visible]
  );
  res.json({ visible });
});

// ---------------------------------------------------------------- teams
const joinLimiter = rateLimit({
  windowMs: 60 * 1000, limit: 10, keyGenerator: (req) => `u${req.user.id}`,
  message: { error: 'Too many attempts. Wait a minute and try again.' },
});
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O/1/I
const newJoinCode = () => Array.from(crypto.randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join('');
const nameSchema = z.object({ name: z.string().trim().min(2).max(40) });

async function myTeam(userId) {
  const t = await query(
    `SELECT t.id,t.name,t.join_code,t.owner_id FROM teams t JOIN team_members m ON m.team_id=t.id WHERE m.user_id=$1`,
    [userId]
  );
  return t.rows[0] || null;
}

router.get('/teams/mine', async (req, res) => {
  const t = await myTeam(req.user.id);
  if (!t) return res.json({ team: null });
  const members = await query(
    `SELECT u.id,u.name,
       COALESCE((SELECT SUM(amount) FROM xp_transactions x WHERE x.user_id=u.id),0)::int AS xp,
       COALESCE((SELECT SUM(amount) FROM xp_transactions x WHERE x.user_id=u.id AND x.created_at >= date_trunc('week', now())),0)::int AS weekly_xp
     FROM team_members m JOIN users u ON u.id=m.user_id WHERE m.team_id=$1 ORDER BY xp DESC, u.id`,
    [t.id]
  );
  res.json({
    team: { id: t.id, name: t.name, joinCode: t.join_code, isOwner: t.owner_id === req.user.id, members: members.rows, totalXp: members.rows.reduce((a, m) => a + m.xp, 0) },
  });
});

router.post('/teams', async (req, res) => {
  const p = nameSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Team name must be 2-40 characters' });
  if (await myTeam(req.user.id)) return res.status(400).json({ error: 'You are already in a team. Leave it first.' });
  for (let i = 0; i < 5; i++) {
    try {
      const t = await query('INSERT INTO teams(name,join_code,owner_id) VALUES ($1,$2,$3) RETURNING id', [p.data.name, newJoinCode(), req.user.id]);
      await query('INSERT INTO team_members(team_id,user_id) VALUES ($1,$2)', [t.rows[0].id, req.user.id]);
      return res.status(201).json({ ok: true });
    } catch (e) {
      if (e.code !== '23505') throw e;   // join-code collision: draw another
    }
  }
  res.status(500).json({ error: 'Could not create the team, try again' });
});

router.post('/teams/join', joinLimiter, async (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) return res.status(400).json({ error: 'Join codes are 6 letters or digits' });
  if (await myTeam(req.user.id)) return res.status(400).json({ error: 'You are already in a team. Leave it first.' });
  const t = await query('SELECT id,name FROM teams WHERE join_code=$1', [code]);
  if (!t.rows[0]) return res.status(404).json({ error: 'No team has that code' });
  const size = Number((await query('SELECT COUNT(*)::int AS n FROM team_members WHERE team_id=$1', [t.rows[0].id])).rows[0].n);
  if (size >= MAX_TEAM_SIZE) return res.status(400).json({ error: `This team is full (${MAX_TEAM_SIZE} members)` });
  await query('INSERT INTO team_members(team_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [t.rows[0].id, req.user.id]);
  res.json({ ok: true, team: t.rows[0].name });
});

router.post('/teams/leave', async (req, res) => {
  const t = await myTeam(req.user.id);
  if (!t) return res.status(400).json({ error: 'You are not in a team' });
  await query('DELETE FROM team_members WHERE user_id=$1', [req.user.id]);
  const rest = await query('SELECT user_id FROM team_members WHERE team_id=$1 ORDER BY joined_at, user_id', [t.id]);
  if (!rest.rows.length) await query('DELETE FROM teams WHERE id=$1', [t.id]);
  else if (t.owner_id === req.user.id) await query('UPDATE teams SET owner_id=$2 WHERE id=$1', [t.id, rest.rows[0].user_id]);
  res.json({ ok: true });
});

export default router;
