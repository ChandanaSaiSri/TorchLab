# Deploying TorchLab for free

| Part | Host | Free tier notes |
|---|---|---|
| Website | Vercel | Hobby plan |
| API | Render (Docker web service) | Sleeps after 15 min idle; ~1 min to wake |
| Database | Neon Postgres | 0.5 GB, no expiry |
| Code runner | Hugging Face Space (Docker) | 16 GB RAM CPU; sleeps after ~48 h idle |

Set one secret string (call it `RUNNER_TOKEN`, any long random text) and reuse it in steps 2 and 3.

## 1. Database (Neon)
neon.tech -> create a project -> copy the connection string (ends with `?sslmode=require`). The schema applies itself when the API starts.

## 2. Code runner (Hugging Face Space)
1. huggingface.co -> New Space -> SDK **Docker** (Blank) -> CPU basic (free). Make it public.
2. Upload the contents of the `runner/` folder (Dockerfile, app.py, requirements.txt, README.md) to the Space's files.
3. Space Settings -> Variables and secrets -> New secret `RUNNER_TOKEN`.
4. When it shows "Running", open `https://<user>-<space>.hf.space/health`. The Space URL is shown under "Embed this Space".

## 3. API (Render)
Dashboard -> New -> Blueprint -> pick the repo. Fill in `DATABASE_URL`, `RUNNER_URL` (the .hf.space URL), `RUNNER_TOKEN`, `ADMIN_EMAILS`, `APP_URL` (placeholder for now). Open `https://<api>.onrender.com/api/health` -> `{"ok":true}`.

## 4. Website (Vercel)
1. In `client/vercel.json` replace `YOUR-API-HOST` with the Render host, commit and push.
2. Vercel -> Add New -> Project -> the repo, **Root Directory = `client`** -> Deploy.
3. Back in Render set `APP_URL` to the Vercel URL. For Google sign-in add that URL to the OAuth client's authorized origins.

Then register with your `ADMIN_EMAILS` email and run one Practice challenge to confirm the runner works.
