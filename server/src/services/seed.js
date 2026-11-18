import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '../db.js';

const CONTENT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../content');

/**
 * Lesson file format:
 *   ---
 *   slug: ...   (optional; defaults to file name)
 *   title: ...
 *   xp: 20
 *   ---
 *   markdown theory
 *   <!-- STARTER -->
 *   python starter code
 *   <!-- QUIZ -->
 *   [ {"q": "...", "options": [...], "answer": 0, "explain": "..."} ]
 */
export function parseLesson(raw, fileName) {
  const text = raw.replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`Bad lesson front matter: ${fileName}`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const [rest, quizPart = ''] = m[2].split('<!-- QUIZ -->');
  const [md, starter = ''] = rest.split('<!-- STARTER -->');
  return {
    slug: meta.slug || fileName.replace(/^\d+-/, '').replace(/\.md$/, ''),
    title: meta.title,
    xp: Number(meta.xp || 20),
    content_md: md.trim(),
    starter_code: starter.trim() + '\n',
    quiz: JSON.parse(quizPart.trim() || '[]'),
  };
}

export async function seedContent() {
  const dirs = (await fs.readdir(CONTENT_DIR, { withFileTypes: true })).filter((d) => d.isDirectory());
  for (const dir of dirs) {
    const base = path.join(CONTENT_DIR, dir.name);
    const course = JSON.parse(await fs.readFile(path.join(base, 'course.json'), 'utf8'));
    const { rows } = await query(
      `INSERT INTO courses(slug,title,description,level,position,source) VALUES ($1,$2,$3,$4,$5,'file')
       ON CONFLICT (slug) DO UPDATE SET title = CASE WHEN courses.source='file' THEN EXCLUDED.title ELSE courses.title END,
         description = CASE WHEN courses.source='file' THEN EXCLUDED.description ELSE courses.description END,
         level = CASE WHEN courses.source='file' THEN EXCLUDED.level ELSE courses.level END,
         position = EXCLUDED.position
       RETURNING id`,
      [dir.name, course.title, course.description, course.level, course.position]
    );
    const courseId = rows[0].id;
    const files = (await fs.readdir(base)).filter((f) => f.endsWith('.md')).sort();
    for (const [i, file] of files.entries()) {
      const l = parseLesson(await fs.readFile(path.join(base, file), 'utf8'), file);
      await query(
        `INSERT INTO lessons(course_id,slug,title,position,content_md,starter_code,quiz,xp,source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'file')
         ON CONFLICT (course_id,slug) DO UPDATE SET title=EXCLUDED.title, position=EXCLUDED.position,
           content_md=EXCLUDED.content_md, starter_code=EXCLUDED.starter_code,
           quiz=EXCLUDED.quiz, xp=EXCLUDED.xp
         WHERE lessons.source='file'`,
        [courseId, l.slug, l.title, i + 1, l.content_md, l.starter_code, JSON.stringify(l.quiz), l.xp]
      );
    }
  }
}

/** Promote the accounts listed in ADMIN_EMAILS (comma separated) to admin. Runs at every start. */
export async function promoteAdmins() {
  const emails = (process.env.ADMIN_EMAILS || '').split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
  for (const email of emails) {
    const r = await query("UPDATE users SET role='admin' WHERE email=$1 AND role<>'admin' RETURNING id", [email]);
    if (r.rowCount) console.log(`Admin role granted to ${email}`);
  }
}
