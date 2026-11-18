---
title: Serving a Model as an API
xp: 40
---
## From notebook to service

A model is only useful when something else can call it. The usual shape is an HTTP service: a client sends JSON, the server runs the model, and returns JSON.

## A minimal FastAPI service

```python
from fastapi import FastAPI
from pydantic import BaseModel
import torch

app = FastAPI()
model = load_model()          # load ONCE at startup, never per request
model.eval()

class Features(BaseModel):
    values: list[float]

@app.post("/predict")
def predict(body: Features):
    x = torch.tensor(body.values).unsqueeze(0)
    with torch.inference_mode():
        probs = torch.softmax(model(x), dim=-1)[0]
    return {"label": int(probs.argmax()), "confidence": float(probs.max())}
```

Run with `uvicorn app:app`. FastAPI also generates interactive docs at `/docs`.

## Production concerns

- **Validate input** (length, type, range) and return clear 4xx errors instead of crashing.
- **Load the model once** at startup; keep it in memory.
- **Health endpoint** such as `/health` for load balancers.
- **Batching and concurrency**: heavy models may need a queue and worker processes.
- **Versioning and monitoring**: log the model version, latency and input statistics so you notice drift.
- **Security**: never `torch.load` files from untrusted sources, because pickle can execute code (use `weights_only=True`).

The starter simulates the request handler as a plain function so you can run and test the logic here without a web server.

<!-- STARTER -->
import json
import time
import torch
from torch import nn

torch.manual_seed(0)
LABELS = ["setosa-like", "versicolor-like", "virginica-like"]
N_FEATURES = 4

# "Startup": build and load the model once
model = nn.Sequential(nn.Linear(N_FEATURES, 8), nn.ReLU(), nn.Linear(8, 3)).eval()

class BadRequest(Exception):
    pass

def predict_handler(payload: str) -> dict:
    """What the POST /predict endpoint would do."""
    try:
        body = json.loads(payload)
    except json.JSONDecodeError:
        raise BadRequest("body must be valid JSON")
    values = body.get("values")
    if not isinstance(values, list) or len(values) != N_FEATURES:
        raise BadRequest(f"'values' must be a list of {N_FEATURES} numbers")
    if not all(isinstance(v, (int, float)) for v in values):
        raise BadRequest("'values' must contain only numbers")

    t0 = time.perf_counter()
    x = torch.tensor(values, dtype=torch.float32).unsqueeze(0)
    with torch.inference_mode():
        probs = torch.softmax(model(x), dim=-1)[0]
    return {
        "label": LABELS[int(probs.argmax())],
        "confidence": round(float(probs.max()), 4),
        "latency_ms": round((time.perf_counter() - t0) * 1000, 3),
    }

def call(payload):
    try:
        return 200, predict_handler(payload)
    except BadRequest as e:
        return 422, {"error": str(e)}

print(call('{"values": [5.1, 3.5, 1.4, 0.2]}'))
print(call('{"values": [5.1, 3.5]}'))
print(call('{"values": [5.1, "x", 1.4, 0.2]}'))
print(call('not json'))

# Simple load test: 200 requests
t0 = time.perf_counter()
for _ in range(200):
    call('{"values": [6.0, 2.9, 4.5, 1.5]}')
print(f"200 requests in {(time.perf_counter() - t0) * 1000:.1f} ms")

# Try it: add a check that rejects NaN values with a 422.
<!-- QUIZ -->
[
  {"q": "Where should the model be loaded in a serving app?", "options": ["On every request", "Once at startup", "In the client", "Only after the first error"], "answer": 1, "explain": "Loading is slow; do it once and reuse the in-memory model."},
  {"q": "What status code is appropriate when the client sends malformed input?", "options": ["200", "4xx (e.g. 422)", "500", "301"], "answer": 1, "explain": "Client mistakes are 4xx; 5xx means the server failed."},
  {"q": "Why use torch.load(..., weights_only=True) for files from others?", "options": ["It is faster", "Pickle files can execute arbitrary code when loaded", "It compresses the file", "It enables the GPU"], "answer": 1, "explain": "A malicious pickle can run code on load; weights_only restricts loading to tensor data."}
]
