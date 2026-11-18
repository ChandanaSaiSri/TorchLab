---
title: NumPy Essentials
xp: 25
---
## The array library under almost everything

NumPy provides the `ndarray`: a fast, fixed-type, n-dimensional array. PyTorch tensors were designed to feel like NumPy arrays, and the two convert cheaply.

## Why arrays instead of lists

A Python loop over a million numbers is slow. **Vectorised** NumPy code does the same work in compiled loops, often 50-100x faster:

```python
import numpy as np
a = np.arange(5)        # [0 1 2 3 4]
a * 2 + 1               # applied to every element, no loop
```

## The same ideas you already met

- Attributes: `a.shape`, `a.ndim`, `a.dtype`.
- Reshaping and indexing: `a.reshape(2, 3)`, `a[:, 1]`, boolean masks.
- Reductions with an axis: `a.mean(axis=0)`, `a.std(axis=1)`.
- **Broadcasting** follows the same rules as in PyTorch.
- Randomness: use a seeded generator, `rng = np.random.default_rng(0)`.

## Bridging to PyTorch

```python
t = torch.from_numpy(arr)   # shares memory with arr
arr2 = t.numpy()            # shares memory with t (CPU tensors only)
```

Because memory is shared, changing one changes the other. Use `.copy()` or `.clone()` if you do not want that. NumPy defaults to `float64`, while PyTorch models use `float32`, so convert with `.float()` when needed.

<!-- STARTER -->
import time
import numpy as np
import torch

rng = np.random.default_rng(0)
data = rng.normal(loc=5.0, scale=2.0, size=(1000, 3))
print("shape:", data.shape, "dtype:", data.dtype)
print("column means:", data.mean(axis=0).round(2))
print("column stds :", data.std(axis=0).round(2))

# Standardise each column with broadcasting: (1000, 3) - (3,)
z = (data - data.mean(axis=0)) / data.std(axis=0)
print("after standardising, means ~", z.mean(axis=0).round(6))

# Vectorised vs loop
big = rng.random(1_000_000)
t0 = time.perf_counter(); total_loop = 0.0
for v in big: total_loop += v
t1 = time.perf_counter(); total_vec = big.sum(); t2 = time.perf_counter()
print(f"loop {t1 - t0:.3f}s vs vectorised {t2 - t1:.5f}s")

# NumPy <-> PyTorch share memory
arr = np.array([1.0, 2.0, 3.0])
t = torch.from_numpy(arr)
arr[0] = 99
print("tensor sees the change:", t)
print("dtype float64 -> model dtype:", t.float().dtype)

# Try it: use .copy() before from_numpy and confirm the tensor no longer changes.
<!-- QUIZ -->
[
  {"q": "Why is vectorised NumPy code usually much faster than a Python for-loop?", "options": ["It uses less memory always", "The looping happens in compiled code, not in the Python interpreter", "It skips some numbers", "It runs on the GPU"], "answer": 1, "explain": "NumPy runs the loop in optimised C code over a typed array."},
  {"q": "You call torch.from_numpy(arr) and then change arr. What happens to the tensor?", "options": ["Nothing, it is a copy", "It changes too, since memory is shared", "It raises an error", "It becomes float16"], "answer": 1, "explain": "from_numpy shares memory. Use arr.copy() first if you need independence."},
  {"q": "For an array of shape (1000, 3), what shape does .mean(axis=0) return?", "options": ["(1000,)", "(3,)", "(1000, 3)", "()"], "answer": 1, "explain": "axis=0 is collapsed, leaving one mean per column: shape (3,)."}
]
