// Hosting platforms often hand over just "host:port", so add the scheme when it is missing.
const RAW_RUNNER = process.env.RUNNER_URL || 'http://localhost:8000';
const RUNNER_URL = (/^https?:\/\//.test(RAW_RUNNER) ? RAW_RUNNER : `http://${RAW_RUNNER}`).replace(/\/+$/, '');

const AUTH = process.env.RUNNER_TOKEN ? { 'x-runner-token': process.env.RUNNER_TOKEN } : {};

export class RunnerError extends Error {}

/** Send a program to the sandboxed runner. Throws RunnerError if the runner is busy or unreachable. */
export async function runProgram(code, files = {}, data = {}) {
  let r;
  try {
    r = await fetch(`${RUNNER_URL}/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...AUTH },
      body: JSON.stringify({ code, files, data }),
      signal: AbortSignal.timeout(Number(process.env.RUNNER_TIMEOUT_MS) || 40000),
    });
  } catch {
    throw new RunnerError('Code runner is unavailable right now.');
  }
  if (!r.ok) throw new RunnerError(r.status === 429 ? 'The runner is busy. Try again in a moment.' : 'The runner failed to execute your code.');
  return r.json();
}

let infoCache = { at: 0, value: null };
/** Versions and limits of the runner, cached for a minute. Returns null if the runner cannot be reached. */
export async function runnerInfo() {
  if (infoCache.value && Date.now() - infoCache.at < 60000) return infoCache.value;
  try {
    const r = await fetch(`${RUNNER_URL}/info`, { headers: AUTH, signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    infoCache = { at: Date.now(), value: await r.json() };
    return infoCache.value;
  } catch {
    return null;
  }
}
