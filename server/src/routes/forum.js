import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { awardXp, recordActivity } from '../services/activity.js';
import { mailEnabled } from '../services/mailer.js';

const router = Router();
router.use(requireAuth);

export const CATEGORIES = ['general', 'help', 'projects', 'showcase', 'feedback'];
export const ANSWER_XP = 15;
const PAGE = 20;

const limiter = (limit, what) => rateLimit({
  windowMs: 60 * 60 * 1000,
  limit,
  keyGenerator: (req) => `u${req.user.id}`,
  message: { error: `You are posting too fast. Max ${limit} ${what} per hour.` },
});
const threadLimiter = limiter(10, 'new threads');
const postLimiter = limiter(40, 'replies');
const voteLimiter = rateLimit({ windowMs: 60 * 1000, limit: 60, keyGenerator: (req) => `u${req.user.id}`, message: { error: 'Too many votes. Slow down.' } });

const intId = (v) => (/^\d+$/.test(String(v)) ? Number(v) : null);
const bad = (res, msg) => res.status(400).json({ error: msg });

// Moderators are admins and instructors. Read from the database so role changes apply immediately.
router.use(async (req, _res, next) => {
  const { rows } = await query('SELECT role FROM users WHERE id=$1', [req.user.id]);
  req.isMod = rows[0]?.role === 'admin' || rows[0]?.role === 'instructor';
  next();
});

// With email configured, new threads and replies need a confirmed address (limits throwaway-account spam).
// Without SMTP (local use) nobody could ever confirm, so the rule is off.
const needVerified = async (req, res, next) => {
  if (!mailEnabled || req.isMod) return next();
  const { rows } = await query('SELECT email_verified FROM users WHERE id=$1', [req.user.id]);
  if (rows[0]?.email_verified) return next();
  res.status(403).json({ error: 'Confirm your email address first. Check your inbox for the link, or request a new one from the banner at the top.' });
};

const threadBody = z.object({
  category: z.enum(CATEGORIES),
  title: z.string().trim().min(5, 'Title needs at least 5 characters').max(150),
  body_md: z.string().trim().min(10, 'Say a bit more (at least 10 characters)').max(8000),
});
const postBody = z.object({ body_md: z.string().trim().min(2, 'Write something first').max(8000) });

// ------------------------------------------------------------------ list
router.get('/threads', async (req, res) => {
  const args = [];
  const where = ['NOT t.deleted'];
  if (CATEGORIES.includes(req.query.category)) { args.push(req.query.category); where.push(`t.category=$${args.length}`); }
  const q = String(req.query.q || '').trim().slice(0, 80);
  if (q) { args.push(`%${q.replace(/[%_]/g, '\\$&')}%`); where.push(`(t.title ILIKE $${args.length} OR t.body_md ILIKE $${args.length})`); }
  if (req.query.sort === 'unanswered') where.push('t.replies = 0 AND t.accepted_post_id IS NULL');
  const order = req.query.sort === 'top' ? 't.votes DESC, t.last_activity_at DESC' : 't.last_activity_at DESC';
  const page = Math.max(1, intId(req.query.page) || 1);
  // `replies` and `votes` are computed in the inner select so the filters and the sort can use them.
  const from = `
    FROM (
      SELECT t.*, u.name AS author,
        (SELECT COUNT(*) FROM forum_posts p WHERE p.thread_id=t.id AND NOT p.deleted)::int AS replies,
        (SELECT COUNT(*) FROM forum_votes v WHERE v.target_type='thread' AND v.target_id=t.id)::int AS votes
      FROM forum_threads t JOIN users u ON u.id=t.user_id
    ) t WHERE ${where.join(' AND ')}`;
  const total = (await query(`SELECT COUNT(*)::int AS n ${from}`, args)).rows[0].n;
  const rows = (await query(
    `SELECT t.id,t.category,t.title,t.pinned,t.locked,(t.accepted_post_id IS NOT NULL) AS answered,
            t.author,t.user_id,t.replies,t.votes,t.created_at,t.last_activity_at
     ${from} ORDER BY t.pinned DESC, ${order} LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`,
    args
  )).rows;
  res.json({ threads: rows, page, pages: Math.max(1, Math.ceil(total / PAGE)), total, categories: CATEGORIES, isMod: req.isMod });
});

// ------------------------------------------------------------------ one thread
router.get('/threads/:id', async (req, res) => {
  const id = intId(req.params.id);
  const t = id ? (await query(
    `SELECT t.*, u.name AS author FROM forum_threads t JOIN users u ON u.id=t.user_id WHERE t.id=$1`, [id])).rows[0] : null;
  if (!t || (t.deleted && !req.isMod)) return res.status(404).json({ error: 'Thread not found' });
  const posts = (await query(
    `SELECT p.id,p.user_id,p.body_md,p.deleted,p.created_at,u.name AS author FROM forum_posts p JOIN users u ON u.id=p.user_id
     WHERE p.thread_id=$1 ORDER BY p.id`, [id])).rows;
  const votes = (await query(
    `SELECT target_type, target_id, COUNT(*)::int AS n, BOOL_OR(user_id=$2) AS mine FROM forum_votes
     WHERE (target_type='thread' AND target_id=$1) OR (target_type='post' AND target_id = ANY($3::int[]))
     GROUP BY target_type, target_id`, [id, req.user.id, posts.map((p) => p.id)])).rows;
  const vote = (type, tid) => { const v = votes.find((x) => x.target_type === type && x.target_id === tid); return { votes: v?.n || 0, voted: !!v?.mine }; };
  const shape = (p) => ({
    id: p.id, author: p.author, authorId: p.user_id, created_at: p.created_at,
    deleted: p.deleted,
    // A removed post keeps its place in the thread, but only moderators can still read it.
    body_md: p.deleted && !req.isMod ? '' : p.body_md,
    accepted: t.accepted_post_id === p.id, mine: p.user_id === req.user.id, ...vote('post', p.id),
  });
  res.json({
    thread: {
      id: t.id, category: t.category, title: t.title, body_md: t.body_md, pinned: t.pinned, locked: t.locked, deleted: t.deleted,
      author: t.author, authorId: t.user_id, created_at: t.created_at, mine: t.user_id === req.user.id,
      canAccept: t.user_id === req.user.id || req.isMod, ...vote('thread', t.id),
    },
    posts: posts.map(shape),
    isMod: req.isMod,
    answerXp: ANSWER_XP,
  });
});

// ------------------------------------------------------------------ write
router.post('/threads', needVerified, threadLimiter, async (req, res) => {
  const parsed = threadBody.safeParse(req.body);
  if (!parsed.success) return bad(res, parsed.error.issues[0].message);
  const d = parsed.data;
  const r = await query(
    'INSERT INTO forum_threads(user_id,category,title,body_md) VALUES ($1,$2,$3,$4) RETURNING id',
    [req.user.id, d.category, d.title, d.body_md]
  );
  await recordActivity(req.user.id);
  res.status(201).json({ id: r.rows[0].id });
});

router.post('/threads/:id/posts', needVerified, postLimiter, async (req, res) => {
  const id = intId(req.params.id);
  const parsed = postBody.safeParse(req.body);
  if (!parsed.success) return bad(res, parsed.error.issues[0].message);
  const t = id ? (await query('SELECT id,locked,deleted FROM forum_threads WHERE id=$1', [id])).rows[0] : null;
  if (!t || t.deleted) return res.status(404).json({ error: 'Thread not found' });
  if (t.locked && !req.isMod) return res.status(403).json({ error: 'This thread is locked' });
  const r = await query('INSERT INTO forum_posts(thread_id,user_id,body_md) VALUES ($1,$2,$3) RETURNING id', [id, req.user.id, parsed.data.body_md]);
  await query('UPDATE forum_threads SET last_activity_at=now() WHERE id=$1', [id]);
  await recordActivity(req.user.id);
  res.status(201).json({ id: r.rows[0].id });
});

/** Authors can edit their own text; moderators can edit anything (for example to remove a leaked email address). */
router.put('/threads/:id', async (req, res) => {
  const id = intId(req.params.id);
  const parsed = z.object({ title: threadBody.shape.title, body_md: threadBody.shape.body_md }).safeParse(req.body);
  if (!parsed.success) return bad(res, parsed.error.issues[0].message);
  const t = id ? (await query('SELECT user_id,locked,deleted FROM forum_threads WHERE id=$1', [id])).rows[0] : null;
  if (!t || t.deleted) return res.status(404).json({ error: 'Thread not found' });
  if (t.user_id !== req.user.id && !req.isMod) return res.status(403).json({ error: 'You can only edit your own thread' });
  if (t.locked && !req.isMod) return res.status(403).json({ error: 'This thread is locked' });
  await query('UPDATE forum_threads SET title=$1, body_md=$2 WHERE id=$3', [parsed.data.title, parsed.data.body_md, id]);
  res.json({ ok: true });
});

router.put('/posts/:id', async (req, res) => {
  const id = intId(req.params.id);
  const parsed = postBody.safeParse(req.body);
  if (!parsed.success) return bad(res, parsed.error.issues[0].message);
  const p = id ? (await query('SELECT p.user_id,p.deleted,t.locked FROM forum_posts p JOIN forum_threads t ON t.id=p.thread_id WHERE p.id=$1', [id])).rows[0] : null;
  if (!p || p.deleted) return res.status(404).json({ error: 'Reply not found' });
  if (p.user_id !== req.user.id && !req.isMod) return res.status(403).json({ error: 'You can only edit your own reply' });
  if (p.locked && !req.isMod) return res.status(403).json({ error: 'This thread is locked' });
  await query('UPDATE forum_posts SET body_md=$1 WHERE id=$2', [parsed.data.body_md, id]);
  res.json({ ok: true });
});

router.delete('/threads/:id', async (req, res) => {
  const id = intId(req.params.id);
  const t = id ? (await query('SELECT user_id FROM forum_threads WHERE id=$1', [id])).rows[0] : null;
  if (!t) return res.status(404).json({ error: 'Thread not found' });
  if (t.user_id !== req.user.id && !req.isMod) return res.status(403).json({ error: 'You can only delete your own thread' });
  await query('UPDATE forum_threads SET deleted=TRUE WHERE id=$1', [id]);
  res.json({ ok: true });
});

router.delete('/posts/:id', async (req, res) => {
  const id = intId(req.params.id);
  const p = id ? (await query('SELECT user_id,thread_id FROM forum_posts WHERE id=$1', [id])).rows[0] : null;
  if (!p) return res.status(404).json({ error: 'Reply not found' });
  if (p.user_id !== req.user.id && !req.isMod) return res.status(403).json({ error: 'You can only delete your own reply' });
  await query('UPDATE forum_posts SET deleted=TRUE WHERE id=$1', [id]);
  // A removed reply can no longer be the accepted answer.
  await query('UPDATE forum_threads SET accepted_post_id=NULL WHERE id=$1 AND accepted_post_id=$2', [p.thread_id, id]);
  res.json({ ok: true });
});

// ------------------------------------------------------------------ votes and answers
router.post('/vote', voteLimiter, async (req, res) => {
  const parsed = z.object({ type: z.enum(['thread', 'post']), id: z.number().int().positive() }).safeParse(req.body);
  if (!parsed.success) return bad(res, 'type and id are required');
  const { type, id } = parsed.data;
  const target = (await query(
    type === 'thread' ? 'SELECT user_id FROM forum_threads WHERE id=$1 AND NOT deleted' : 'SELECT user_id FROM forum_posts WHERE id=$1 AND NOT deleted', [id])).rows[0];
  if (!target) return res.status(404).json({ error: 'Not found' });
  if (target.user_id === req.user.id) return bad(res, 'You cannot vote for your own post');
  const del = await query('DELETE FROM forum_votes WHERE user_id=$1 AND target_type=$2 AND target_id=$3', [req.user.id, type, id]);
  if (!del.rowCount) await query('INSERT INTO forum_votes(user_id,target_type,target_id) VALUES ($1,$2,$3)', [req.user.id, type, id]);
  const n = (await query('SELECT COUNT(*)::int AS n FROM forum_votes WHERE target_type=$1 AND target_id=$2', [type, id])).rows[0].n;
  res.json({ votes: n, voted: !del.rowCount });
});

/** Thread author (or a moderator) marks the reply that solved it. The answerer earns XP once per thread. */
router.post('/threads/:id/accept', async (req, res) => {
  const id = intId(req.params.id);
  const postId = req.body?.postId === null ? null : intId(req.body?.postId);
  const t = id ? (await query('SELECT user_id,accepted_post_id FROM forum_threads WHERE id=$1 AND NOT deleted', [id])).rows[0] : null;
  if (!t) return res.status(404).json({ error: 'Thread not found' });
  if (t.user_id !== req.user.id && !req.isMod) return res.status(403).json({ error: 'Only the thread author can accept an answer' });
  if (postId === null) { // un-accept
    await query('UPDATE forum_threads SET accepted_post_id=NULL WHERE id=$1', [id]);
    return res.json({ accepted: null });
  }
  const p = (await query('SELECT user_id FROM forum_posts WHERE id=$1 AND thread_id=$2 AND NOT deleted', [postId, id])).rows[0];
  if (!p) return res.status(404).json({ error: 'Reply not found in this thread' });
  await query('UPDATE forum_threads SET accepted_post_id=$1 WHERE id=$2', [postId, id]);
  let xp = 0;
  // No XP for answering yourself, and only the first accepted answer of a thread pays out.
  if (p.user_id !== t.user_id && (await awardXp(p.user_id, ANSWER_XP, 'forum_answer', id))) xp = ANSWER_XP;
  if (xp) await recordActivity(p.user_id);
  res.json({ accepted: postId, xpAwarded: xp });
});

// ------------------------------------------------------------------ moderation
router.patch('/threads/:id/mod', async (req, res) => {
  if (!req.isMod) return res.status(403).json({ error: 'Moderators only' });
  const id = intId(req.params.id);
  const parsed = z.object({ pinned: z.boolean().optional(), locked: z.boolean().optional(), deleted: z.boolean().optional(), category: z.enum(CATEGORIES).optional() }).safeParse(req.body);
  if (!id || !parsed.success) return bad(res, 'Nothing valid to change');
  const sets = Object.keys(parsed.data);
  if (!sets.length) return bad(res, 'Nothing to change');
  const r = await query(
    `UPDATE forum_threads SET ${sets.map((k, i) => `${k}=$${i + 1}`).join(', ')} WHERE id=$${sets.length + 1} RETURNING id`,
    [...sets.map((k) => parsed.data[k]), id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Thread not found' });
  res.json({ ok: true });
});

export default router;
