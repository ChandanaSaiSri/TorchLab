import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '../db.js';
import { parseChallenge } from './challengeFormat.js';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../challenges');

/** Upsert file-based challenges. Rows created or edited in the admin UI (source = 'admin') are never touched. */
export async function seedChallenges() {
  let files = [];
  try {
    files = (await fs.readdir(DIR)).filter((f) => f.endsWith('.md')).sort();
  } catch {
    return;
  }
  for (const [i, file] of files.entries()) {
    const c = parseChallenge(await fs.readFile(path.join(DIR, file), 'utf8'), file);
    await query(
      `INSERT INTO challenges(slug,title,difficulty,category,description_md,starter_code,solution_code,hints,tests,xp,position,source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'file')
       ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title, difficulty=EXCLUDED.difficulty, category=EXCLUDED.category,
         description_md=EXCLUDED.description_md, starter_code=EXCLUDED.starter_code, solution_code=EXCLUDED.solution_code,
         hints=EXCLUDED.hints, tests=EXCLUDED.tests, xp=EXCLUDED.xp, position=EXCLUDED.position
       WHERE challenges.source='file'`,
      [c.slug, c.title, c.difficulty, c.category, c.description_md, c.starter_code, c.solution_code,
        JSON.stringify(c.hints), c.tests, c.xp, i + 1]
    );
  }
}
