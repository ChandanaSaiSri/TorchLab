// Pure helpers for Live Projects (no database). A project is a folder:
//   project.md          front matter (title, level, hours, summary, skills) + overview markdown
//   *.py                helper modules (data generators) written next to the learner's code when it runs
//   NN-slug.md          one file per milestone, same sections as a challenge (STARTER / SOLUTION / HINTS / TESTS)
//
// The learner keeps ONE growing program. Milestone N's STARTER is appended to it when the milestone unlocks and the
// milestone's TESTS are run against the whole program.
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseChallenge } from './challengeFormat.js';

export const PROJECT_XP = 250;
export const LEVELS = ['beginner', 'intermediate', 'advanced'];

function parseFrontMatter(raw, where) {
  const m = raw.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`Bad project front matter: ${where}`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: m[2].trim() };
}

export async function loadProject(dir, folderName) {
  const { meta, body } = parseFrontMatter(await fs.readFile(path.join(dir, 'project.md'), 'utf8'), folderName);
  if (!LEVELS.includes(meta.level)) throw new Error(`Bad level in ${folderName}`);
  const names = await fs.readdir(dir);
  const files = {};
  for (const n of names.filter((x) => x.endsWith('.py')).sort()) files[n] = await fs.readFile(path.join(dir, n), 'utf8');
  const milestones = [];
  for (const n of names.filter((x) => /^\d+-.*\.md$/.test(x)).sort()) {
    const c = parseChallenge(await fs.readFile(path.join(dir, n), 'utf8'), n);
    milestones.push({
      position: milestones.length + 1,
      slug: c.slug,
      title: c.title,
      description_md: c.description_md,
      starter_code: c.starter_code,
      solution_code: c.solution_code,
      hints: c.hints,
      tests: c.tests,
    });
  }
  if (!milestones.length) throw new Error(`No milestones in ${folderName}`);
  return {
    slug: folderName.replace(/^\d+-/, ''),
    title: meta.title,
    level: meta.level,
    hours: Number(meta.hours) || 2,
    summary: meta.summary,
    skills: (meta.skills || '').split(',').map((s) => s.trim()).filter(Boolean),
    overview_md: body,
    files,
    milestones,
  };
}

/** The program a learner has at milestone k: stubs of milestones 1..k, in order, joined. */
export const joinCode = (parts) => parts.map((p) => p.trim()).join('\n\n\n') + '\n';
