import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '../db.js';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assessments');

export async function loadAssessmentFiles() {
  const defs = [];
  for (const f of (await fs.readdir(DIR)).filter((x) => x.endsWith('.json')).sort()) {
    defs.push(JSON.parse(await fs.readFile(path.join(DIR, f), 'utf8')));
  }
  const questions = [];
  const qdir = path.join(DIR, 'questions');
  for (const f of (await fs.readdir(qdir)).filter((x) => x.endsWith('.json')).sort()) {
    questions.push(...JSON.parse(await fs.readFile(path.join(qdir, f), 'utf8')));
  }
  return { defs, questions };
}

/** Upsert file-based questions and assessments. Rows with source = 'admin' are never overwritten. */
export async function seedAssessments() {
  let loaded;
  try {
    loaded = await loadAssessmentFiles();
  } catch {
    return;
  }
  for (const q of loaded.questions) {
    await query(
      `INSERT INTO assessment_questions(qid,section,type,tags,data,source) VALUES ($1,$2,$3,$4,$5,'file')
       ON CONFLICT (qid) DO UPDATE SET section=EXCLUDED.section, type=EXCLUDED.type, tags=EXCLUDED.tags, data=EXCLUDED.data
       WHERE assessment_questions.source='file'`,
      [q.qid, q.section, q.type, q.tags, JSON.stringify(q.data)]
    );
  }
  for (const a of loaded.defs) {
    await query(
      `INSERT INTO assessments(slug,title,kind,description,config,position,source) VALUES ($1,$2,$3,$4,$5,$6,'file')
       ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title, kind=EXCLUDED.kind, description=EXCLUDED.description,
         config=EXCLUDED.config, position=EXCLUDED.position
       WHERE assessments.source='file'`,
      [a.slug, a.title, a.kind, a.description, JSON.stringify(a.config), a.position]
    );
  }
}
