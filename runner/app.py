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

# Import torch once at startup so the OS file cache is warm; otherwise the first
# user program can spend most of its time budget just loading PyTorch.
try:
    import torch  # noqa: F401
except ImportError:
    pass

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
    import torch

    return {"ok": True, "torch": torch.__version__, "cuda": torch.cuda.is_available()}


@app.get("/info")
def info():
    """What the learner's code runs on. Shown in the Playground's Runtime panel."""
    import importlib.util
    import platform

    libs = {}
    for name in ("torch", "numpy", "matplotlib", "pandas", "scipy", "sklearn", "torchvision"):
        if importlib.util.find_spec(name) is None:
            continue
        try:
            libs[name] = getattr(__import__(name), "__version__", "installed")
        except Exception:
            libs[name] = "installed"
    device = "CPU"
    try:
        import torch

        if torch.cuda.is_available():
            device = "CUDA: " + torch.cuda.get_device_name(0)
    except Exception:
        pass
    return {
        "python": platform.python_version(),
        "device": device,
        "libraries": libs,
        "limits": {"timeoutSeconds": TIMEOUT, "memoryMb": MAX_MEM // (1024 * 1024), "outputChars": MAX_OUT, "concurrent": int(os.getenv("MAX_CONCURRENT", "2"))},
    }


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
            env.update({"OMP_NUM_THREADS": "2", "MPLBACKEND": "Agg", "PYTHONDONTWRITEBYTECODE": "1"})
            start = time.monotonic()
            try:
                p = subprocess.run(
                    [sys.executable, "-E", "-s", path],
                    cwd=workdir,
                    env=env,
                    capture_output=True,
                    text=True,
                    timeout=TIMEOUT,
                    preexec_fn=None if (IS_WINDOWS or resource is None) else _limits,
                )
                status = "success" if p.returncode == 0 else "error"
                out, err = p.stdout, p.stderr
            except subprocess.TimeoutExpired as e:
                status = "timeout"
                out = (e.stdout or b"").decode() if isinstance(e.stdout, bytes) else (e.stdout or "")
                err = f"Execution timed out after {TIMEOUT}s"
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
