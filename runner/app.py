"""TorchLab execution service.

Runs one user program per request in a throwaway temp dir, in a child process
with CPU/memory/file-size limits and a wall-clock timeout. This service is meant
to live in a locked-down container (no network, read-only FS, dropped caps) --
see docker-compose.yml. Never expose it publicly; only the Node API calls it.
"""
import base64
import glob
import os
import re
import subprocess
import sys
import tempfile
import threading
import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

try:
    import resource  # Unix only; on Windows we rely on the timeout alone
except ImportError:
    resource = None

IS_WINDOWS = os.name == "nt"
TIMEOUT = int(os.getenv("RUN_TIMEOUT", "20"))
MAX_MEM = int(os.getenv("MAX_MEMORY_MB", "2048")) * 1024 * 1024
MAX_OUT = 50_000  # characters returned per stream
slots = threading.BoundedSemaphore(int(os.getenv("MAX_CONCURRENT", "2")))

# Optionally import torch once at startup so the OS file cache is warm (WARM_TORCH=1). It is off by default:
# the parent process then stays tiny, which matters on small hosts (a loaded torch costs ~300 MB of RAM here).
if os.getenv("WARM_TORCH") == "1":
    try:
        import torch  # noqa: F401
    except ImportError:
        pass

# Stop a program whose private memory passes this many MB (0 = off). Protects a small host from being OOM-killed.
MAX_PROGRAM_MB = int(os.getenv("MAX_PROGRAM_MB", "0"))

app = FastAPI(title="TorchLab runner")

# Optional shared secret. When RUNNER_TOKEN is set (public hosting), every call except /health must carry it.
RUNNER_TOKEN = os.environ.get("RUNNER_TOKEN", "")


@app.middleware("http")
async def require_token(request: Request, call_next):
    if RUNNER_TOKEN and request.url.path != "/health":
        sent = request.headers.get("x-runner-token", "")
        import hmac
        if not hmac.compare_digest(sent, RUNNER_TOKEN):
            return JSONResponse({"detail": "unauthorized"}, status_code=401)
    return await call_next(request)


FILE_NAME = re.compile(r"^[a-z][a-z0-9_]{0,40}\.py$")
# Learner-uploaded datasets: plain-text tables and JSON only, written next to main.py so open("iris.csv") works.
DATA_NAME = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_.-]{0,60}\.(csv|tsv|json|txt)$")


class RunRequest(BaseModel):
    code: str = Field(max_length=40_000)
    # Extra helper modules written next to main.py (e.g. a project's data generator). Python files only.
    files: dict[str, str] = Field(default_factory=dict)
    # Learner datasets (name -> text). Max 8 files, 1 MB of text each.
    data: dict[str, str] = Field(default_factory=dict)


def _limits():
    resource.setrlimit(resource.RLIMIT_CPU, (TIMEOUT, TIMEOUT))
    resource.setrlimit(resource.RLIMIT_AS, (MAX_MEM * 2, MAX_MEM * 2))
    resource.setrlimit(resource.RLIMIT_FSIZE, (20 * 1024 * 1024,) * 2)
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))


def _clip(s: str) -> str:
    return s if len(s) <= MAX_OUT else s[:MAX_OUT] + "\n...[output truncated]"


def _collect_images(workdir: str):
    """PNG files the program saved (e.g. plt.savefig) are returned inline, max 4 files of 2 MB."""
    images = []
    for path in sorted(glob.glob(os.path.join(workdir, "*.png")))[:4]:
        if os.path.getsize(path) <= 2 * 1024 * 1024:
            with open(path, "rb") as f:
                images.append({"name": os.path.basename(path), "data": base64.b64encode(f.read()).decode()})
    return images


@app.get("/health")
def health():
    from importlib import metadata

    try:
        version = metadata.version("torch")
    except metadata.PackageNotFoundError:
        version = None
    return {"ok": True, "torch": version}


@app.get("/info")
def info():
    """What the learner's code runs on. Shown in the Playground's Runtime panel."""
    import importlib.util
    import platform

    libs = {}
    for name in ("torch", "numpy", "matplotlib", "pandas", "scipy", "sklearn", "torchvision"):
        if importlib.util.find_spec(name) is None:
            continue
        dist = {"sklearn": "scikit-learn"}.get(name, name)
        try:
            from importlib import metadata

            libs[name] = metadata.version(dist)
        except Exception:
            libs[name] = "installed"
    # Never import torch here: that would load it into this long-lived process. Learner code runs on CPU.
    device = "CPU"
    return {
        "python": platform.python_version(),
        "device": device,
        "libraries": libs,
        "limits": {"timeoutSeconds": TIMEOUT, "memoryMb": MAX_MEM // (1024 * 1024), "outputChars": MAX_OUT, "concurrent": int(os.getenv("MAX_CONCURRENT", "2"))},
    }


def _private_mb(pid):
    """Private (non-shared, non-file) memory of a process in MB, from /proc. None if unreadable."""
    try:
        with open(f"/proc/{pid}/status") as f:
            for line in f:
                if line.startswith("RssAnon:"):
                    return int(line.split()[1]) // 1024
    except OSError:
        return None
    return None


def _watch_memory(proc, done, flag):
    while not done.wait(0.1):
        mb = _private_mb(proc.pid)
        if mb is not None and mb > MAX_PROGRAM_MB:
            flag["oom"] = True
            proc.kill()
            return


@app.post("/run")
def run(req: RunRequest):
    if len(req.files) > 8 or any(not FILE_NAME.match(n) or n == "main.py" or len(c) > 30_000 for n, c in req.files.items()):
        raise HTTPException(status_code=422, detail="Invalid helper files")
    if len(req.data) > 8 or any(not DATA_NAME.match(n) or len(c) > 1_000_000 for n, c in req.data.items()):
        raise HTTPException(status_code=422, detail="Invalid dataset files")
    if not slots.acquire(timeout=5):
        raise HTTPException(status_code=429, detail="Runner is busy, try again shortly")
    try:
        with tempfile.TemporaryDirectory() as workdir:
            path = os.path.join(workdir, "main.py")
            with open(path, "w", encoding="utf-8") as f:
                f.write(req.code)
            for name, content in {**req.data, **req.files}.items():
                with open(os.path.join(workdir, name), "w", encoding="utf-8", newline="") as f:
                    f.write(content)
            if IS_WINDOWS:
                # Windows needs SYSTEMROOT etc. for Python/torch DLLs to load.
                keep = ("SYSTEMROOT", "PATH", "PATHEXT", "TEMP", "TMP", "USERPROFILE", "LOCALAPPDATA", "APPDATA")
                env = {k: v for k, v in os.environ.items() if k.upper() in keep}
            else:
                env = {"PATH": "/usr/local/bin:/usr/bin", "HOME": workdir}
            env.update({"OMP_NUM_THREADS": os.getenv("OMP_THREADS", "2"), "MPLBACKEND": "Agg", "PYTHONDONTWRITEBYTECODE": "1"})
            start = time.monotonic()
            oom = False
            try:
                proc = subprocess.Popen(
                    [sys.executable, "-E", "-s", path],
                    cwd=workdir,
                    env=env,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    preexec_fn=None if (IS_WINDOWS or resource is None) else _limits,
                )
                done = threading.Event()
                flag = {"oom": False}
                if MAX_PROGRAM_MB and not IS_WINDOWS:
                    threading.Thread(target=_watch_memory, args=(proc, done, flag), daemon=True).start()
                try:
                    out, err = proc.communicate(timeout=TIMEOUT)
                    status = "success" if proc.returncode == 0 else "error"
                except subprocess.TimeoutExpired:
                    proc.kill()
                    out, err = proc.communicate()
                    status = "timeout"
                    err = f"Execution timed out after {TIMEOUT}s"
                finally:
                    done.set()
                if flag["oom"]:
                    status = "error"
                    err = f"Your program used more than {MAX_PROGRAM_MB} MB of memory and was stopped. Try smaller tensors or batches."
            except OSError:
                raise HTTPException(status_code=500, detail="Could not start the program")
            ms = int((time.monotonic() - start) * 1000)
            return {
                "status": status,
                "stdout": _clip(out),
                "stderr": _clip(err),
                "runtime_ms": ms,
                "images": _collect_images(workdir),
            }
    finally:
        slots.release()
