# TorchLab

Learn. Code. Experiment. Build. An interactive PyTorch learning platform: lessons, a live Python/PyTorch editor, quizzes, XP and streaks.

**Status: v0.1 - foundation + academy + compiler.** Auth, dashboard, profile, 6 original lessons with quizzes, a Monaco-based compiler with saved programs and execution history, XP ledger and streaks.

## Architecture

```
React (Vite, Monaco)  ->  Node/Express API  ->  Python runner (FastAPI)
                              |                   internal network, no internet
                          PostgreSQL              read-only FS, dropped caps, CPU/mem/pid limits
```

- `client/` React SPA. `/api` is proxied to the server in dev.
- `server/` Express 5 API, JWT in an httpOnly cookie, zod validation, rate limits. Lessons live in `server/content/` as Markdown and are upserted into Postgres on start.
- `runner/` executes one program per request in a throwaway directory with rlimits and a timeout.
- `server/schema.sql` is idempotent; the API applies it on every start.

## Run it

Requirements: Docker, Node 20+.

```bash
cp .env.example .env            # set JWT_SECRET
docker compose up --build       # db + runner + API on :4000 (first build downloads PyTorch CPU, ~1 GB)
cd client && npm install && npm run dev   # http://localhost:5173
```

Register an account and open the first lesson.

## Run without Docker (Windows / macOS / Linux)

Needs Node 20+ and Python 3.10+. Open **three terminals** in the `torchlab` folder:

```powershell
# 1. Database (downloads a Postgres binary via npm on first run; Ctrl+C to stop, data is kept)
cd server
npm install
npm run db:local

# 2. Code runner
cd runner
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt   # includes PyTorch, ~1 GB first time
python -m uvicorn app:app --port 8000

# 3. API + website (two more terminals: one for each)
cd server && npm run dev
cd client && npm install && npm run dev      # http://localhost:5173
```

Local mode has no network or memory sandboxing for user code (Windows only enforces the 20 s timeout). That is fine for you on your own machine; use Docker before letting other people run code.

## Google sign-in (optional)

Email/password login works out of the box. To also show "Continue with Google":

1. Open https://console.cloud.google.com/apis/credentials, create a project if needed, configure the OAuth consent screen (External, add your email as a test user), then **Create credentials > OAuth client ID > Web application**.
2. Under **Authorized JavaScript origins** add `http://localhost:5173` (and your real site URL later). No redirect URI is needed.
3. (Windows launcher) Run `start-local.bat` and paste the Client ID when it asks; it is remembered in `google-client-id.txt` (delete that file to change it). Otherwise copy the **Client ID** (ends in `.apps.googleusercontent.com`) into `server/.env` as `GOOGLE_CLIENT_ID=...` (copy `server/.env.example` first). With Docker, put it in the root `.env` instead.
4. Restart the API. The Google button appears on the login and sign-up pages.

How it works: the browser gets a signed ID token from Google, the API verifies it against your client ID, and signs the user in. If an account with the same verified email already exists it is linked; otherwise a new password-less account is created. Passwords are never involved for Google users.

## Adding lessons

Add a numbered `.md` file to `server/content/<course-slug>/` (see `01-meet-the-tensor.md`): front matter, Markdown theory, `<!-- STARTER -->` code, `<!-- QUIZ -->` JSON. Restart the server to re-seed. Add a `course.json` for a new course folder.

Lessons here are original text and code written for this project. If you adapt material from elsewhere, check its license and credit it.

## Security notes

User code is untrusted. The runner is only reachable from the API over an internal Docker network and must never be exposed publicly. Current isolation is a shared long-lived container with per-run process limits. Before opening to the public, move to one short-lived container per run (or gVisor/Firecracker) and add a job queue.

## Roadmap

1. Practice arena: challenges with hidden test cases, auto-grading, difficulty-based XP
2. Assessments: timed exams, attempt history
3. Projects with milestones and evaluation thresholds
4. BullMQ job queue + per-run containers
5. Leaderboards, badges, certificates, admin dashboard, AI assistant, visual tensor explorer (all built)

## Live Projects, certificates and portfolio

Four guided projects (Digit Recognizer, Shape Classifier, Sentiment Analyzer, Mini Transformer) live in `server/projects/`.
Each folder holds `project.md`, helper data modules (`*.py`) and numbered milestone files (starter, solution, hints, tests).
Completing a project awards 250 XP and a certificate with a public verification page (`/verify/<code>`); completed projects appear in the portfolio (`/portfolio`, optionally public).
Check that every project's solutions pass and starters fail (runner must be running): `cd server && npm run validate:projects`.

## Achievements, leaderboards and teams

- **Badges** (`server/src/services/achievements.js`): First Steps, Tensor Master, Gradient Guru, Model Builder, Project Explorer, PyTorch Pro, Consistency Champion, plus Challenge Crusher, Assessment Ace and Rising Star. Each is worth 25 XP, awarded once. They are re-checked after every learning action, so adding a new badge is one entry in `BADGES`.
- **Course certificates** are issued automatically when every lesson of a course is complete (verify at `/verify/<code>`).
- **Leaderboard** (`/leaderboard`): weekly, monthly and all-time XP, for everyone or just your team. Learners can hide their name from the public board.
- **Teams**: create a team, share the 6-character join code, one team per learner (max 50 members).

## Dashboard, profile and recommendations

- **Level** is derived from total XP (Beginner, Learner at 250, Practitioner at 750, Advanced at 1,500, Expert at 3,000), see `server/src/services/levels.js`.
- **Recommendations** (`services/recommendations.js`) are plain rules: resume an active project, next lesson, the practice category you struggle with, retake a failed assessment, apply a finished course in a project. Each suggestion shows its reason.
- **Learning time** is measured with a heartbeat every 30 s while the tab is visible and you are active. The server credits only the real time since the previous beat, so it cannot be inflated.
- The **profile** page shows level progress, learning time, a one-year activity heatmap, badges, certificates and assessment history.

## Admin dashboard and community forum

**Becoming an admin.** New accounts are students. Pick one of:

- Put your email in `admin-emails.txt` (one or more addresses, comma separated) before launching with `start-local.bat`. The API promotes those accounts every time it starts. Sign up first, then restart the API.
- Or run `npm run make-admin -- you@example.com` inside `server/` (add `instructor` as a second argument for a content-only role).
- In production set the `ADMIN_EMAILS` environment variable.

Admins then promote others under **Admin → Users**. Roles are read from the database on every request, so a demotion takes effect immediately.

**Roles.** *Instructors* edit content and moderate the forum. *Admins* also manage users. Nobody can change their own role.

**Admin → Overview.** Learners, activity, sign-ups, hardest challenges, where learners stop in lessons, runner usage.

**Admin → Lessons / Challenges / Assessment questions.** Create and edit content in the browser.
- Anything edited or created here is marked `admin` and is never overwritten when the server restarts and re-reads `server/content`, `challenges` and `assessments`. Untouched file content keeps updating from the files.
- Challenges and coding questions are checked in the sandbox before saving: the reference solution must pass every test and the untouched starter must not. If the runner is down, the save is refused rather than storing an unchecked exercise.
- Challenge XP follows difficulty (10 / 25 / 50 / 100). Hide a challenge or turn a question off instead of deleting it, so learners' history is kept.

**Community.** Categories, search, latest / top / no-replies sorting, Markdown posts, votes (not on your own posts), edit and delete your own. The thread author can mark one reply as the answer; its author earns 15 XP, once per thread, never for answering yourself. Moderators (instructors and admins) can pin, lock, and remove posts; removed replies stay visible to moderators only. Posting is rate-limited (10 threads and 40 replies per hour per user).

## Email verification and password reset

- **Forgot password:** "Forgot your password?" on the login page emails a one-hour, single-use link. The page answers the same way whether or not the address has an account, so it cannot be used to find out who is registered. Requesting a new link cancels the old one, and at most 5 requests per hour are accepted per address.
- **Email confirmation:** new password sign-ups get a 24-hour confirmation link and see a banner until they confirm. Google sign-ups and all accounts that existed before this update count as confirmed. Using a reset link also confirms the address.
- **Change password:** on the Profile page. A Google-only account can add a password there without a current one.
- Tokens are stored only as SHA-256 hashes.

**Sending real email.** Set `SMTP_URL` (for example `smtps://you@gmail.com:app-password@smtp.gmail.com:465`), `MAIL_FROM` and `APP_URL` (your site address, used in the links) in `server/.env` or the Docker `.env`. Without `SMTP_URL`, nothing is sent: each email is printed in the API window, so on your own computer you can copy the link from there. When `SMTP_URL` is set, posting in the community requires a confirmed address.

Known limit: changing a password does not sign out other devices that are already logged in (sessions last until the cookie expires).

## Playground upgrades, AI help and Explore

**Notebooks.** In the Playground, `+ Notebook` makes a program of separate cells. Running a cell re-runs every cell above it in one fresh Python process (like a restarted kernel), so variables are never stale. Tracebacks name the cell (`<cell 2>`). Limits: 30 cells, 20,000 characters per cell. Shift+Enter runs a cell and moves on.

**Saved programs.** Favorite, archive, search and delete programs (up to 100 per user). `Share` makes a read-only link (`/s/<token>`) that anyone can open without an account; it shows only the author's display name. `Turn off sharing` kills the link. Signed-in users can make their own copy of a shared program.

**Datasets.** Upload `.csv`, `.tsv`, `.json` or `.txt` files (8 files, 500 KB each, 1 MB total). They are placed next to your program on every run, so `open("data.csv")` works. `Samples` offers eight starter programs; run `node server/scripts/validate-samples.mjs` (with the runner up) to check they all still run. `Runtime info` shows Python and library versions.

**AI help (optional).** Explain / fix an error / hint / review, in the Playground, lessons, practice challenges and project milestones. It is hidden until the server has a key:
- Windows launcher: put your Anthropic API key in a file `anthropic-api-key.txt` next to `start-local.bat` (git-ignored, never prompted for).
- Otherwise set `ANTHROPIC_API_KEY` (optional `AI_MODEL`, default `claude-sonnet-5-5`; `AI_DAILY_LIMIT`, default 40 requests per user per day).

Privacy and fairness: the server adds the task text itself and never sends tests, reference solutions or personal data. On challenges and project milestones, answers that reproduce most of the reference solution are withheld. AI help is paused while an assessment attempt is in progress. Users see their remaining daily quota.

**Explore** (`/explore`). Two in-browser tools that need no server: a tensor explorer (reshape, permute, slice, reduce, broadcast and matmul with live shapes, error messages and equivalent PyTorch you can open in the Playground) and a model architecture visualizer (type `nn.Sequential`-style layers, see each output shape and parameter count, catch shape mismatches). Unit tests: `node client/tests/sim.test.mjs`.
