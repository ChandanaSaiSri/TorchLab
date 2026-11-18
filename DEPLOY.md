# Deploying TorchLab

**Fast path:** `render.yaml` in this folder creates the database, runner and API on Render in one step (Dashboard → New → Blueprint → choose your GitHub repo). Then do step 4 (Vercel). The manual steps below explain what it sets up.

Vercel hosts the **website** (client). The API (Express), the database (Postgres) and the code runner (Python + PyTorch) are long-running services, so they go on a container host. Vercel then forwards `/api/*` to the API, which keeps the login cookie on one domain.

## 1. Database
Create a hosted Postgres (Neon, Supabase, Render, Railway…). Copy its connection string. The schema applies itself on API start.

## 2. Code runner
Deploy `runner/` as a container (it has a Dockerfile) on Render, Railway, Fly.io or similar. It needs about 1 GB RAM for PyTorch. Do not expose it publicly: use the host's private networking, or at least keep its URL secret. Note its URL.

## 3. API
Deploy `server/` (has a Dockerfile). Environment variables:
- `DATABASE_URL` = your Postgres string
- `RUNNER_URL` = the runner URL from step 2
- `JWT_SECRET` = a long random string (required; never reuse the dev value)
- `NODE_ENV=production`, `TRUST_PROXY=1`
- `APP_URL` = your Vercel site URL (used in emails)
- `ADMIN_EMAILS` = your email
- Optional: `ANTHROPIC_API_KEY`, `SMTP_URL` + `MAIL_FROM`, `GOOGLE_CLIENT_ID`
Check `https://<api-host>/api/health` returns `{"ok":true}`.

## 4. Website on Vercel
1. In `client/vercel.json` replace `YOUR-API-HOST` with the API host from step 3.
2. Import the repo in Vercel, set **Root Directory** to `client`. Vercel detects Vite.
3. Deploy. For Google sign-in, add the Vercel URL to the OAuth client's authorized origins.

## After deploying
Register, then check Learn, Practice (runs code), Playground, and `/admin`.
Free-tier hosts sleep when idle, so the first request after a pause can be slow.
