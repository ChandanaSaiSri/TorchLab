---
title: GPU Training and Efficiency
xp: 40
---
## Why GPUs

Deep learning is dominated by large matrix multiplications, which a GPU performs thousands of times in parallel. The practical rules:

- Put the **model and every batch on the same device**.
- Keep the GPU busy: use sensible batch sizes and avoid slow Python work in the loop.
- Copying between CPU and GPU is expensive, so avoid calling `.item()` or `.cpu()` on every step.

```python
device = "cuda" if torch.cuda.is_available() else "cpu"
model.to(device)
loader = DataLoader(ds, batch_size=64, shuffle=True, pin_memory=(device == "cuda"))
for xb, yb in loader:
    xb, yb = xb.to(device, non_blocking=True), yb.to(device, non_blocking=True)
```

## Mixed precision

Running parts of the model in 16-bit (`float16` or `bfloat16`) speeds up training and halves memory:

```python
with torch.autocast(device_type=device, dtype=torch.bfloat16):
    loss = loss_fn(model(xb), yb)
```

With `float16` on GPU you also use a gradient scaler (`torch.amp.GradScaler`) to avoid underflow; `bfloat16` normally does not need it.

## Gradient accumulation

If a big batch does not fit in memory, process several **micro-batches** and step once:

```python
loss = loss_fn(model(xb), yb) / accumulation_steps
loss.backward()                       # gradients add up
if (i + 1) % accumulation_steps == 0:
    optimizer.step(); optimizer.zero_grad()
```

Dividing the loss keeps the result equal to one large-batch step, as the starter verifies.

## Multiple GPUs

`DistributedDataParallel` (DDP) runs one process per GPU, each with a copy of the model and a slice of the data, and averages gradients. It is the standard approach for scaling training. This platform's runner is CPU-only, so the examples here run on CPU, but the same code works on GPU unchanged.

<!-- STARTER -->
import time
import torch
from torch import nn

torch.manual_seed(0)
device = "cuda" if torch.cuda.is_available() else "cpu"
print("device:", device, "| cuda available:", torch.cuda.is_available())

model = nn.Sequential(nn.Linear(20, 64), nn.ReLU(), nn.Linear(64, 1)).to(device)
X = torch.randn(32, 20, device=device)
y = torch.randn(32, 1, device=device)

# --- Gradient accumulation == one big batch -------------------------------
model.zero_grad()
nn.functional.mse_loss(model(X), y).backward()
big_batch = [p.grad.clone() for p in model.parameters()]

model.zero_grad()
steps = 4
for xb, yb in zip(X.chunk(steps), y.chunk(steps)):
    (nn.functional.mse_loss(model(xb), yb) / steps).backward()
accumulated = [p.grad.clone() for p in model.parameters()]
print("accumulated grads match big batch:",
      all(torch.allclose(a, b, atol=1e-6) for a, b in zip(big_batch, accumulated)))

# --- Mixed precision (bfloat16 works on CPU too) ----------------------------
with torch.autocast(device_type=device, dtype=torch.bfloat16):
    out = model(X)
print("autocast output dtype:", out.dtype, "| master weights dtype:", model[0].weight.dtype)

# --- Why batching matters ---------------------------------------------------
data = torch.randn(2048, 20, device=device)
model.eval()
with torch.inference_mode():
    t0 = time.perf_counter()
    for row in data[:512]:
        model(row.unsqueeze(0))
    one_by_one = time.perf_counter() - t0
    t0 = time.perf_counter()
    model(data[:512])
    batched = time.perf_counter() - t0
print(f"512 samples: one-by-one {one_by_one * 1000:.1f} ms vs one batch {batched * 1000:.1f} ms")

# Try it: change steps to 8. Do the accumulated gradients still match?
<!-- QUIZ -->
[
  {"q": "Why divide the loss by the number of accumulation steps?", "options": ["To make training faster", "So the summed gradients equal those of one large batch", "To avoid NaN always", "To change the learning rate"], "answer": 1, "explain": "Each micro-batch loss is a mean over a smaller batch; scaling keeps the total equal to the big-batch mean."},
  {"q": "What must be true of the model and a batch before the forward pass?", "options": ["Both float64", "Both on the same device", "Both in eval mode", "Both detached"], "answer": 1, "explain": "Mixing CPU and GPU tensors raises a device mismatch error."},
  {"q": "What is mixed precision mainly for?", "options": ["Higher accuracy always", "Faster training and lower memory by using 16-bit numbers where safe", "Replacing the optimizer", "Shuffling data"], "answer": 1, "explain": "Lower-precision math is faster and uses less memory; master weights stay in float32."}
]
