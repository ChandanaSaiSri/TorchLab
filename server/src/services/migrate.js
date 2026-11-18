import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '../db.js';

const SCHEMA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../schema.sql');

/** Apply the idempotent schema so new and existing databases are both up to date. */
export async function migrate() {
  await query(await fs.readFile(SCHEMA, 'utf8'));
}
