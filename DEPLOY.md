# Deploying TorchLab for free (no card)

| Part | Host | Notes |
|---|---|---|
| Website | Vercel (Hobby) | free |
| API + code runner | Render, two free web services | each sleeps after 15 min idle; first request after a pause takes about a minute |
| Database | Neon Postgres | 0.5 GB, no expiry |

The runner is tuned to fit Render's free 512 MB: PyTorch is no longer kept loaded in the server process, one program runs at a time (`MAX_CONCURRENT=1`), and a program that uses more than `MAX_PROGRAM_MB` (380) of private memory is stopped with a clear message instead of crashing the host. Very large tensors or models will hit that limit; that is expected on a free host. If runs fail with "out of memory" or the runner restarts, move the runner to a plan with more RAM (Render Starter, 2 GB) and raise `MAX_PROGRAM_MB` and `MAX_CONCURRENT`.

## 1. Database (Neon)
neon.tech -> new project -> copy the connection string (ends with `?sslmode=require`). The schema applies itself when the API starts.

## 2. Runner and API (Render)
Render dashboard -> New -> Blueprint -> pick the repo. It creates `torchlab-runner` and `torchlab-api`. Fill in:
- `DATABASE_URL`: the Neon string
- `ADMIN_EMAILS`: your email
- `APP_URL`: a placeholder for now
- `RUNNER_URL`: leave blank at first. After the runner finishes building, copy its address (like `https://torchlab-runner-xxxx.onrender.com`), set it on `torchlab-api` -> Environment, and save.
The runner secret is generated and shared between the two services automatically.
Checks: `https://<runner>.onrender.com/health` and `https://<api>.onrender.com/api/health`.

## 3. Website (Vercel)
1. In `client/vercel.json` replace `YOUR-API-HOST` with the API host (no `https://`), commit and push.
2. Vercel -> Add New -> Project -> the repo, **Root Directory = `client`** -> Deploy.
3. In Render set the API's `APP_URL` to the Vercel URL. For Google sign-in add that URL to the OAuth client's authorized origins.

Then register with your `ADMIN_EMAILS` email and run one Practice challenge. The first run after an idle period may take a minute while both services wake.
