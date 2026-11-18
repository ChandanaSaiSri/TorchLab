import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { recordActivity } from '../services/activity.js';
import { RunnerError, runProgram, runnerInfo } from '../services/runner.js';
import { checkCells, composeCells, joinCells, splitOutputs } from '../services/notebookRunner.js';

const router = Router();
router.use(requireAuth);

const runLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  keyGenerator: (req) => `u${req.user.id}`,
  message: { error: 'Slow down: max 15 runs per minute' },
});

const MAX_NOTEBOOKS = 100;
export const DATASET_LIMITS = { files: 8, bytesEach: 500 * 1024, bytesTotal: 1024 * 1024 };
const DATASET_NAME = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,60}\.(csv|tsv|json|txt)$/;

const intId = (v) => (/^\d+$/.test(String(v)) ? Number(v) : null);

/** The learner's uploaded datasets as {name: text}, ready to hand to the runner. */
async function datasetsFor(userId) {
  const { rows } = await query('SELECT name, content FROM user_datasets WHERE user_id=$1 ORDER BY name', [userId]);
  return Object.fromEntries(rows.map((r) => [r.name, r.content]));
}

async function runAndRecord(req, res, { program, files = {}, savedCode, notebookId, after }) {
  let result;
  try {
    result = await runProgram(program, files, await datasetsFor(req.user.id));
  } catch (e) {
    if (e instanceof RunnerError) return res.status(503).json({ error: e.message });
    throw e;
  }
  const saved = await query(
    `INSERT INTO code_executions(user_id,notebook_id,code,stdout,stderr,status,runtime_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [req.user.id, notebookId ?? null, savedCode, result.stdout, result.stderr, result.status, result.runtime_ms]
  );
  await recordActivity(req.user.id);
  res.json({ id: saved.rows[0].id, ...(after ? after(result) : result) });
}

// ------------------------------------------------------------------ run
const execSchema = z.object({
  code: z.string().min(1).max(20000),
  notebookId: z.number().int().positive().optional(),
});

router.post('/execute', runLimiter, async (req, res) => {
  const p = execSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Code is required (max 20,000 characters)' });
  await runAndRecord(req, res, { program: p.data.code, savedCode: p.data.code, notebookId: p.data.notebookId });
});

const cellsSchema = z.object({
  cells: z.array(z.string()),
  upTo: z.number().int().min(0).optional(),
  notebookId: z.number().int().positive().optional(),
});

/** Run cells 1..upTo (default: all) as one program and hand back each cell's own output. */
router.post('/execute-cells', runLimiter, async (req, res) => {
  const p = cellsSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'cells must be a list of code strings' });
  const bad = checkCells(p.data.cells);
  if (bad) return res.status(400).json({ error: bad });
  const upTo = Math.min(p.data.upTo ?? p.data.cells.length - 1, p.data.cells.length - 1);
  if (!p.data.cells.slice(0, upTo + 1).some((c) => c.trim())) return res.status(400).json({ error: 'There is no code to run' });
  const { program, nonce } = composeCells(p.data.cells, upTo);
  await runAndRecord(req, res, {
    program, savedCode: joinCells(p.data.cells.slice(0, upTo + 1)), notebookId: p.data.notebookId,
    after: (r) => {
      const { outputs, lastCell } = splitOutputs(r.stdout, nonce, upTo + 1);
      const failed = r.status !== 'success';
      return {
        status: r.status, runtime_ms: r.runtime_ms, images: r.images,
        cells: outputs.map((o, i) => ({ ran: o !== null, output: o ?? '' })),
        errorCell: failed ? Math.max(lastCell, 0) : null,
        stderr: r.stderr,
      };
    },
  });
});

router.get('/history', async (req, res) => {
  const { rows } = await query(
    `SELECT id,code,stdout,stderr,status,runtime_ms,created_at
     FROM code_executions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
    [req.user.id]
  );
  res.json({ executions: rows });
});

router.get('/runtime', async (_req, res) => {
  const info = await runnerInfo();
  if (!info) return res.status(503).json({ error: 'Code runner is unavailable right now.' });
  res.json({ ...info, datasets: DATASET_LIMITS });
});

// ------------------------------------------------------------------ saved programs and notebooks
const nbSchema = z.object({
  title: z.string().trim().min(1).max(100),
  kind: z.enum(['script', 'notebook']).default('script'),
  code: z.string().max(20000).default(''),
  cells: z.array(z.string()).optional(),
});

function nbValues(d) {
  if (d.kind === 'notebook') {
    const bad = checkCells(d.cells);
    if (bad) return { error: bad };
    return { code: joinCells(d.cells), cells: JSON.stringify(d.cells) };
  }
  return { code: d.code, cells: null };
}

const LIST_COLS = `id,title,kind,favorite,archived,(share_token IS NOT NULL) AS shared,updated_at`;

router.get('/notebooks', async (req, res) => {
  const { rows } = await query(`SELECT ${LIST_COLS} FROM code_notebooks WHERE user_id=$1 ORDER BY updated_at DESC`, [req.user.id]);
  res.json({ notebooks: rows });
});

router.get('/notebooks/:id', async (req, res) => {
  const id = intId(req.params.id);
  const { rows } = await query(
    `SELECT ${LIST_COLS},code,cells,share_token AS "shareToken" FROM code_notebooks WHERE id=$1 AND user_id=$2`,
    [id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json({ notebook: rows[0] });
});

router.post('/notebooks', async (req, res) => {
  const p = nbSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  const v = nbValues(p.data);
  if (v.error) return res.status(400).json({ error: v.error });
  const n = (await query('SELECT COUNT(*)::int AS n FROM code_notebooks WHERE user_id=$1', [req.user.id])).rows[0].n;
  if (n >= MAX_NOTEBOOKS) return res.status(400).json({ error: `You can keep up to ${MAX_NOTEBOOKS} programs. Delete some you no longer need.` });
  const { rows } = await query(
    `INSERT INTO code_notebooks(user_id,title,kind,code,cells) VALUES ($1,$2,$3,$4,$5) RETURNING ${LIST_COLS}`,
    [req.user.id, p.data.title, p.data.kind, v.code, v.cells]
  );
  res.status(201).json({ notebook: rows[0] });
});

router.put('/notebooks/:id', async (req, res) => {
  const p = nbSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
  const v = nbValues(p.data);
  if (v.error) return res.status(400).json({ error: v.error });
  const { rows } = await query(
    `UPDATE code_notebooks SET title=$1, kind=$2, code=$3, cells=$4, updated_at=now()
     WHERE id=$5 AND user_id=$6 RETURNING ${LIST_COLS}`,
    [p.data.title, p.data.kind, v.code, v.cells, intId(req.params.id), req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json({ notebook: rows[0] });
});

router.patch('/notebooks/:id', async (req, res) => {
  const p = z.object({ favorite: z.boolean().optional(), archived: z.boolean().optional() }).safeParse(req.body);
  if (!p.success || (p.data.favorite === undefined && p.data.archived === undefined)) return res.status(400).json({ error: 'favorite or archived (true/false) is required' });
  const { rows } = await query(
    `UPDATE code_notebooks SET favorite=COALESCE($1,favorite), archived=COALESCE($2,archived)
     WHERE id=$3 AND user_id=$4 RETURNING ${LIST_COLS}`,
    [p.data.favorite ?? null, p.data.archived ?? null, intId(req.params.id), req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json({ notebook: rows[0] });
});

router.delete('/notebooks/:id', async (req, res) => {
  await query('DELETE FROM code_notebooks WHERE id=$1 AND user_id=$2', [intId(req.params.id), req.user.id]);
  res.json({ ok: true });
});

// A share link is a read-only snapshot of whatever is saved right now plus later saves; unsharing kills the link.
router.post('/notebooks/:id/share', async (req, res) => {
  const token = crypto.randomBytes(18).toString('base64url');
  const { rows } = await query(
    `UPDATE code_notebooks SET share_token=COALESCE(share_token,$1) WHERE id=$2 AND user_id=$3 RETURNING share_token AS token`,
    [token, intId(req.params.id), req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

router.delete('/notebooks/:id/share', async (req, res) => {
  await query('UPDATE code_notebooks SET share_token=NULL WHERE id=$1 AND user_id=$2', [intId(req.params.id), req.user.id]);
  res.json({ ok: true });
});

/** Save a copy of someone's shared program into my own list. */
router.post('/shared/:token/copy', async (req, res) => {
  const { rows } = await query('SELECT title,kind,code,cells FROM code_notebooks WHERE share_token=$1', [String(req.params.token).slice(0, 100)]);
  const s = rows[0];
  if (!s) return res.status(404).json({ error: 'This link is no longer shared' });
  const n = (await query('SELECT COUNT(*)::int AS n FROM code_notebooks WHERE user_id=$1', [req.user.id])).rows[0].n;
  if (n >= MAX_NOTEBOOKS) return res.status(400).json({ error: `You can keep up to ${MAX_NOTEBOOKS} programs. Delete some you no longer need.` });
  const made = await query(
    `INSERT INTO code_notebooks(user_id,title,kind,code,cells) VALUES ($1,$2,$3,$4,$5) RETURNING ${LIST_COLS}`,
    [req.user.id, `${s.title} (copy)`.slice(0, 100), s.kind, s.code, s.cells ? JSON.stringify(s.cells) : null]
  );
  res.status(201).json({ notebook: made.rows[0] });
});

// ------------------------------------------------------------------ datasets
router.get('/datasets', async (req, res) => {
  const { rows } = await query('SELECT id,name,bytes,created_at FROM user_datasets WHERE user_id=$1 ORDER BY name', [req.user.id]);
  res.json({ datasets: rows, limits: DATASET_LIMITS, usedBytes: rows.reduce((n, r) => n + r.bytes, 0) });
});

router.post('/datasets', async (req, res) => {
  const p = z.object({ name: z.string().trim(), content: z.string() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'name and content are required' });
  const { name, content } = p.data;
  if (!DATASET_NAME.test(name)) return res.status(400).json({ error: 'The file name must end in .csv, .tsv, .json or .txt and use only letters, numbers, dots, dashes and underscores' });
  if (content.includes('\u0000')) return res.status(400).json({ error: 'Only plain text files are supported' });
  const bytes = Buffer.byteLength(content, 'utf8');
  if (bytes === 0) return res.status(400).json({ error: 'The file is empty' });
  if (bytes > DATASET_LIMITS.bytesEach) return res.status(400).json({ error: `Each file can be up to ${DATASET_LIMITS.bytesEach / 1024} KB` });
  const { rows } = await query('SELECT name,bytes FROM user_datasets WHERE user_id=$1', [req.user.id]);
  const others = rows.filter((r) => r.name !== name);
  if (!rows.some((r) => r.name === name) && others.length >= DATASET_LIMITS.files) return res.status(400).json({ error: `You can keep up to ${DATASET_LIMITS.files} files. Delete one first.` });
  if (others.reduce((n, r) => n + r.bytes, bytes) > DATASET_LIMITS.bytesTotal) return res.status(400).json({ error: `Your files can use up to ${DATASET_LIMITS.bytesTotal / 1024} KB in total. Delete one first.` });
  const made = await query(
    `INSERT INTO user_datasets(user_id,name,content,bytes) VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id,name) DO UPDATE SET content=EXCLUDED.content, bytes=EXCLUDED.bytes, created_at=now()
     RETURNING id,name,bytes,created_at`,
    [req.user.id, name, content, bytes]
  );
  res.status(201).json({ dataset: made.rows[0] });
});

router.delete('/datasets/:id', async (req, res) => {
  await query('DELETE FROM user_datasets WHERE id=$1 AND user_id=$2', [intId(req.params.id), req.user.id]);
  res.json({ ok: true });
});

export default router;

// ------------------------------------------------------------------ public, read-only view of a shared program
export const sharedRouter = Router();
sharedRouter.use(rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests' } }));
sharedRouter.get('/:token', async (req, res) => {
  const { rows } = await query(
    `SELECT n.title,n.kind,n.code,n.cells,n.updated_at,u.name AS author
     FROM code_notebooks n JOIN users u ON u.id=n.user_id WHERE n.share_token=$1`,
    [String(req.params.token).slice(0, 100)]
  );
  if (!rows[0]) return res.status(404).json({ error: 'This link is no longer shared' });
  res.json({ program: rows[0] });
});
