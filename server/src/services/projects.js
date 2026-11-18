import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query } from '../db.js';
import { loadProject } from './projectFormat.js';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../projects');

/** Upsert file-based projects and their milestones. Projects edited in the admin UI (source = 'admin') are left alone. */
export async function seedProjects() {
  let folders = [];
  try {
    folders = (await fs.readdir(DIR, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  } catch {
    return;
  }
  for (const [i, folder] of folders.entries()) {
    const p = await loadProject(path.join(DIR, folder), folder);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(
        `INSERT INTO projects(slug,title,level,hours,summary,skills,overview_md,files,position,source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'file')
         ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title, level=EXCLUDED.level, hours=EXCLUDED.hours,
           summary=EXCLUDED.summary, skills=EXCLUDED.skills, overview_md=EXCLUDED.overview_md, files=EXCLUDED.files,
           position=EXCLUDED.position
         WHERE projects.source='file' RETURNING id`,
        [p.slug, p.title, p.level, p.hours, p.summary, JSON.stringify(p.skills), p.overview_md, JSON.stringify(p.files), i + 1]
      );
      if (r.rows[0]) {
        const id = r.rows[0].id;
        for (const m of p.milestones) {
          await client.query(
            `INSERT INTO project_milestones(project_id,position,slug,title,description_md,starter_code,solution_code,hints,tests)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (project_id,position) DO UPDATE SET slug=EXCLUDED.slug, title=EXCLUDED.title,
               description_md=EXCLUDED.description_md, starter_code=EXCLUDED.starter_code,
               solution_code=EXCLUDED.solution_code, hints=EXCLUDED.hints, tests=EXCLUDED.tests`,
            [id, m.position, m.slug, m.title, m.description_md, m.starter_code, m.solution_code, JSON.stringify(m.hints), m.tests]
          );
        }
        await client.query('DELETE FROM project_milestones WHERE project_id=$1 AND position>$2', [id, p.milestones.length]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
