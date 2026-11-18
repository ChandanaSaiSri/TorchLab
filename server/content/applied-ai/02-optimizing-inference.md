---
title: Optimizing Inference
xp: 35
---
## Measure first

Never optimise on a hunch. Time the real workload, warm up first (the first call includes one-off setup), repeat several times and look at the median.

## Easy wins, in order

1. **`torch.inference_mode()`**: skips autograd bookkeeping.
2. **Batching**: one call on 64 inputs is far cheaper than 64 calls on one input, because per-call overhead and parallel hardware are amortised.
3. **Lower precision**: `torch.autocast(..., dtype=torch.bfloat16)` or `model.half()` on GPU cuts memory and often time. Always compare outputs with the float32 baseline.
4. **Exporting / compiling**: `torch.export.export(model, example_inputs)` captures the operations into a graph that can run without your Python code; `torch.compile(model)` fuses operations to run faster. (The older `torch.jit.trace` is deprecated.)
5. **Smaller model**: pruning, distillation or a narrower architecture. This is usually the biggest gain, but it needs retraining and accuracy checks.

## Accuracy must not silently change

Every optimisation changes numbers slightly. Check that predictions (argmax) agree and the maximum output difference is tolerable.

## Latency vs throughput

*Latency* is time for one request; *throughput* is requests per second. Batching improves throughput but can add waiting time, so servers often batch only what arrives within a few milliseconds.

<!-- STARTER -->
import time
import statistics
import torch
from torch import nn

torch.manual_seed(0)
torch.set_num_threads(2)

model = nn.Sequential(nn.Linear(128, 256), nn.ReLU(), nn.Linear(256, 256), nn.ReLU(), nn.Linear(256, 10)).eval()
data = torch.randn(256, 128)

def bench(fn, repeats=7):
    fn()                                           # warm-up
    times = []
    for _ in range(repeats):
        t0 = time.perf_counter(); fn(); times.append(time.perf_counter() - t0)
    return statistics.median(times) * 1000         # ms

def one_by_one():
    with torch.inference_mode():
        for row in data:
            model(row.unsqueeze(0))

def batched():
    with torch.inference_mode():
        model(data)

def with_grad_batched():
    model(data)                                    # autograd graph is built needlessly

print(f"one-by-one      : {bench(one_by_one):8.2f} ms")
print(f"batched         : {bench(batched):8.2f} ms")
print(f"batched, grad on: {bench(with_grad_batched):8.2f} ms")

# Exporting captures the operations as a graph that can run without your Python code
exported = torch.export.export(model, (data[:4],), dynamic_shapes=({0: torch.export.Dim("batch")},))
with torch.inference_mode():
    ref = model(data)
    out = exported.module()(data)
print("exported graph matches original:", torch.allclose(ref, out, atol=1e-6))

# bfloat16 autocast: faster/smaller on supported hardware, slightly different numbers
with torch.inference_mode(), torch.autocast("cpu", dtype=torch.bfloat16):
    low = model(data)
print("bf16 same predictions:", (low.argmax(1) == ref.argmax(1)).float().mean().item())
print("bf16 max abs diff:", f"{(low.float() - ref).abs().max().item():.4f}")

# Try it: change the batch size in batched() to 16. How does the per-sample time change?
<!-- QUIZ -->
[
  {"q": "Why is one batched call faster than many single-sample calls?", "options": ["It uses fewer parameters", "Per-call overhead is shared and hardware parallelism is used better", "It skips the forward pass", "It lowers precision"], "answer": 1, "explain": "Fixed overhead per call is amortised and vectorised math is more efficient on larger inputs."},
  {"q": "After applying an optimisation like bfloat16, what should you do?", "options": ["Assume nothing changed", "Compare outputs and predictions with the float32 baseline", "Retrain from scratch", "Delete the original model"], "answer": 1, "explain": "Numerical changes are small but real; verify predictions agree."},
  {"q": "What does torch.inference_mode() save?", "options": ["Disk space", "The work of tracking operations for autograd", "The model weights", "Random seeds"], "answer": 1, "explain": "No graph is recorded, which reduces memory and time."}
]
