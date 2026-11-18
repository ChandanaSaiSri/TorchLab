-- TorchLab schema. Idempotent: the API applies it on every start, so existing databases upgrade in place.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT,                 -- NULL for Google-only accounts
  google_id     TEXT UNIQUE,
  role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','instructor','admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id    INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio        TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  level      TEXT NOT NULL DEFAULT 'Beginner'
);

CREATE TABLE IF NOT EXISTS courses (
  id          SERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  level       TEXT NOT NULL DEFAULT 'Beginner',
  position    INT  NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS lessons (
  id           SERIAL PRIMARY KEY,
  course_id    INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  slug         TEXT NOT NULL,
  title        TEXT NOT NULL,
  position     INT  NOT NULL DEFAULT 0,
  content_md   TEXT NOT NULL,
  starter_code TEXT NOT NULL DEFAULT '',
  quiz         JSONB NOT NULL DEFAULT '[]',
  xp           INT NOT NULL DEFAULT 20,
  UNIQUE (course_id, slug)
);

-- Lesson completion is tracked separately from course completion (derived).
CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id    INT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  quiz_score   INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS code_notebooks (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'Untitled',
  code       TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Source code and results kept together per run, with status + resource use.
CREATE TABLE IF NOT EXISTS code_executions (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notebook_id INT REFERENCES code_notebooks(id) ON DELETE SET NULL,
  code        TEXT NOT NULL,
  stdout      TEXT NOT NULL DEFAULT '',
  stderr      TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL CHECK (status IN ('success','error','timeout','failed')),
  runtime_ms  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exec_user ON code_executions(user_id, created_at DESC);

-- XP is a ledger (not a single number). UNIQUE makes awards idempotent.
CREATE TABLE IF NOT EXISTS xp_transactions (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     INT NOT NULL,
  reason     TEXT NOT NULL,
  ref        TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, reason, ref)
);

CREATE TABLE IF NOT EXISTS learning_streaks (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     DATE NOT NULL,
  PRIMARY KEY (user_id, day)
);

-- Upgrades for databases created by earlier versions
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_key ON users(google_id);

-- ---------------------------------------------------------------- Practice Arena
CREATE TABLE IF NOT EXISTS challenges (
  id             SERIAL PRIMARY KEY,
  slug           TEXT UNIQUE NOT NULL,
  title          TEXT NOT NULL,
  difficulty     TEXT NOT NULL CHECK (difficulty IN ('easy','medium','hard','expert')),
  category       TEXT NOT NULL,
  description_md TEXT NOT NULL,
  starter_code   TEXT NOT NULL,
  solution_code  TEXT NOT NULL,
  hints          JSONB NOT NULL DEFAULT '[]',
  tests          TEXT NOT NULL,
  xp             INT NOT NULL,
  position       INT NOT NULL DEFAULT 0,
  source         TEXT NOT NULL DEFAULT 'file',   -- 'file' = managed by the repo, 'admin' = created in the admin UI
  published      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenge_progress (
  user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id    INT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  attempts        INT NOT NULL DEFAULT 0,
  hints_used      INT NOT NULL DEFAULT 0,
  solution_viewed BOOLEAN NOT NULL DEFAULT FALSE,
  solved_at       TIMESTAMPTZ,
  xp_awarded      INT NOT NULL DEFAULT 0,
  last_code       TEXT,
  PRIMARY KEY (user_id, challenge_id)
);

CREATE TABLE IF NOT EXISTS challenge_submissions (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id INT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  code         TEXT NOT NULL,
  passed       BOOLEAN NOT NULL,
  tests_passed INT NOT NULL DEFAULT 0,
  tests_total  INT NOT NULL DEFAULT 0,
  status       TEXT NOT NULL,
  runtime_ms   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chsub_user ON challenge_submissions(user_id, challenge_id, created_at DESC);

-- ---------------------------------------------------------------- Assessments
CREATE TABLE IF NOT EXISTS assessment_questions (
  qid       TEXT PRIMARY KEY,
  section   TEXT NOT NULL CHECK (section IN ('theory','coding','practical')),
  type      TEXT NOT NULL CHECK (type IN ('mcq','multi','code')),
  tags      TEXT[] NOT NULL DEFAULT '{}',
  data      JSONB NOT NULL,
  source    TEXT NOT NULL DEFAULT 'file',
  published BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS assessments (
  id          SERIAL PRIMARY KEY,
  slug        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('conceptual','coding','practical','comprehensive')),
  description TEXT NOT NULL DEFAULT '',
  config      JSONB NOT NULL,
  position    INT NOT NULL DEFAULT 0,
  source      TEXT NOT NULL DEFAULT 'file',
  published   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS assessment_attempts (
  id            SERIAL PRIMARY KEY,
  user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessment_id INT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','grading','submitted')),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deadline      TIMESTAMPTZ NOT NULL,
  claimed_at    TIMESTAMPTZ,
  submitted_at  TIMESTAMPTZ,
  layout        JSONB NOT NULL,          -- the random question set + option order drawn for this attempt
  answers       JSONB NOT NULL DEFAULT '{}',
  result        JSONB,
  score         NUMERIC(5,2),
  passed        BOOLEAN
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_attempt_open ON assessment_attempts(user_id, assessment_id) WHERE status IN ('in_progress','grading');
CREATE INDEX IF NOT EXISTS idx_attempt_user ON assessment_attempts(user_id, assessment_id, started_at DESC);

-- ---------------------------------------------------------------- live projects, certificates, portfolio
CREATE TABLE IF NOT EXISTS projects (
  id          SERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  level       TEXT NOT NULL,
  hours       INT NOT NULL DEFAULT 2,
  summary     TEXT NOT NULL DEFAULT '',
  skills      JSONB NOT NULL DEFAULT '[]',
  overview_md TEXT NOT NULL DEFAULT '',
  files       JSONB NOT NULL DEFAULT '{}',      -- helper python modules written next to the learner's code
  position    INT NOT NULL DEFAULT 0,
  published   BOOLEAN NOT NULL DEFAULT TRUE,
  source      TEXT NOT NULL DEFAULT 'file' CHECK (source IN ('file','admin'))
);

CREATE TABLE IF NOT EXISTS project_milestones (
  id             SERIAL PRIMARY KEY,
  project_id     INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position       INT NOT NULL,
  slug           TEXT NOT NULL,
  title          TEXT NOT NULL,
  description_md TEXT NOT NULL,
  starter_code   TEXT NOT NULL,
  solution_code  TEXT NOT NULL,
  hints          JSONB NOT NULL DEFAULT '[]',
  tests          TEXT NOT NULL,
  UNIQUE (project_id, position)
);

CREATE TABLE IF NOT EXISTS project_progress (
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id   INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code         TEXT NOT NULL DEFAULT '',
  unlocked     INT NOT NULL DEFAULT 1,           -- milestones whose starter has been added to the code
  passed       INT NOT NULL DEFAULT 0,           -- highest milestone passed so far (milestones are sequential)
  attempts     JSONB NOT NULL DEFAULT '{}',      -- {"2": 3} submissions per milestone
  hints_used   JSONB NOT NULL DEFAULT '{}',
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, project_id)
);

CREATE TABLE IF NOT EXISTS certificates (
  id        SERIAL PRIMARY KEY,
  code      TEXT NOT NULL UNIQUE,                -- public verification code, e.g. TL-7F3A-91BC-D204
  user_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind      TEXT NOT NULL CHECK (kind IN ('project','course')),
  ref       TEXT NOT NULL,                       -- project slug or course slug
  title     TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, ref)
);

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS portfolio_public BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------- achievements, leaderboards, teams
CREATE TABLE IF NOT EXISTS user_badges (
  user_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code      TEXT NOT NULL,                       -- badge definitions live in services/achievements.js
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen      BOOLEAN NOT NULL DEFAULT FALSE,      -- FALSE until the learner has been shown the "badge earned" toast
  PRIMARY KEY (user_id, code)
);

CREATE TABLE IF NOT EXISTS teams (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  join_code  TEXT NOT NULL UNIQUE,
  owner_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id   INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id   INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,   -- a learner is in at most one team
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS show_on_leaderboard BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_xp_created ON xp_transactions(created_at);

-- ---------------------------------------------------------------- learning time (heartbeat) for the profile page
CREATE TABLE IF NOT EXISTS learning_time (
  user_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day       DATE NOT NULL,
  seconds   INT NOT NULL DEFAULT 0,
  last_beat TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

-- ---------------------------------------------------------------- Admin + community (Batch H)
-- Content edited in the admin UI is marked 'admin' so the file seeder never overwrites it.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'file';
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'file';

CREATE TABLE IF NOT EXISTS forum_threads (
  id               SERIAL PRIMARY KEY,
  user_id          INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category         TEXT NOT NULL CHECK (category IN ('general','help','projects','showcase','feedback')),
  title            TEXT NOT NULL,
  body_md          TEXT NOT NULL,
  pinned           BOOLEAN NOT NULL DEFAULT FALSE,
  locked           BOOLEAN NOT NULL DEFAULT FALSE,
  deleted          BOOLEAN NOT NULL DEFAULT FALSE,
  accepted_post_id INT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS forum_threads_activity ON forum_threads (pinned DESC, last_activity_at DESC);

CREATE TABLE IF NOT EXISTS forum_posts (
  id         SERIAL PRIMARY KEY,
  thread_id  INT NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body_md    TEXT NOT NULL,
  deleted    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS forum_posts_thread ON forum_posts (thread_id, id);

CREATE TABLE IF NOT EXISTS forum_votes (
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('thread','post')),
  target_id   INT NOT NULL,
  PRIMARY KEY (user_id, target_type, target_id)
);

-- ---------------------------------------------------------------- Email verification + password reset (Batch G)
-- Existing accounts are treated as verified; new password sign-ups start unverified (default flipped right after).
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT FALSE;

-- Only a SHA-256 of each token is stored, so a database leak cannot be used to reset passwords.
CREATE TABLE IF NOT EXISTS auth_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('verify','reset')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_tokens_user ON auth_tokens (user_id, kind);

-- ---------------------------------------------------------------- Playground extras (Batch I)
ALTER TABLE code_notebooks ADD COLUMN IF NOT EXISTS kind        TEXT    NOT NULL DEFAULT 'script' CHECK (kind IN ('script','notebook'));
ALTER TABLE code_notebooks ADD COLUMN IF NOT EXISTS cells       JSONB;
ALTER TABLE code_notebooks ADD COLUMN IF NOT EXISTS favorite    BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE code_notebooks ADD COLUMN IF NOT EXISTS archived    BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE code_notebooks ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

-- Small text datasets a learner uploads; they appear as files next to the program when it runs.
CREATE TABLE IF NOT EXISTS user_datasets (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  content    TEXT NOT NULL,
  bytes      INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

-- Only a per-day count of AI assistant requests is kept (never the code or the answers).
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     DATE NOT NULL DEFAULT CURRENT_DATE,
  count   INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
