---
title: Tensor Math and Broadcasting
xp: 20
---
## Element-wise math

Operators on tensors work element by element: `a + b`, `a * b`, `a ** 2`, `torch.exp(a)`. Both tensors must have compatible shapes.

## Reductions

Reductions collapse an axis into a summary: `sum`, `mean`, `max`, `min`, `argmax`. Pass `dim` to choose which axis disappears.

```python
m = torch.tensor([[1., 2., 3.],
                  [4., 5., 6.]])
m.sum()          # 21.
m.sum(dim=0)     # [5., 7., 9.]   collapses the rows
m.mean(dim=1)    # [2., 5.]       collapses the columns
m.argmax()       # index of the largest value (in the flattened tensor)
```

Mean needs a floating-point dtype. If you get an error about `Long`, convert with `.float()`.

## Matrix multiplication

`a @ b` (or `torch.matmul`) is the matrix product, the workhorse of neural networks. The inner sizes must match: `(n, k) @ (k, m)` gives `(n, m)`. It is **not** the same as `a * b`, which multiplies element by element.

## Broadcasting

Broadcasting lets PyTorch combine tensors of different shapes without copying data. Compare shapes from the **right-hand end**. Two sizes are compatible if they are equal or one of them is 1; the size-1 axis is stretched to match. Missing leading axes count as 1.

| A shape | B shape | Result |
|---------|---------|--------|
| (3, 4) | (4,) | (3, 4) |
| (3, 1) | (1, 4) | (3, 4) |
| (3, 4) | (3,) | error: 4 vs 3 |

A common use is subtracting a per-column mean from every row of a dataset.

<!-- STARTER -->
import torch

m = torch.tensor([[1., 2., 3.],
                  [4., 5., 6.]])

print("sum over rows   :", m.sum(dim=0))
print("mean over cols  :", m.mean(dim=1))

# matmul: (2, 3) @ (3, 2) -> (2, 2)
print("matmul:\n", m @ m.T)

# Broadcasting: centre each column
col_mean = m.mean(dim=0)        # shape (3,)
print("centred:\n", m - col_mean) # (2, 3) - (3,) -> (2, 3)

# Outer-sum via broadcasting: (3, 1) + (1, 4) -> (3, 4)
a = torch.arange(3).reshape(3, 1)
b = torch.arange(4).reshape(1, 4)
print("outer sum:\n", a + b)

# Try it: what happens if you try m + torch.tensor([1., 2.])? Read the error message.
<!-- QUIZ -->
[
  {
    "q": "m has shape (2, 3). What is the shape of m.sum(dim=0)?",
    "options": ["(2,)", "(3,)", "(2, 3)", "()"],
    "answer": 1,
    "explain": "dim=0 is the axis that disappears, so only the length-3 axis remains."
  },
  {
    "q": "What is the result shape of adding tensors of shape (3, 1) and (1, 4)?",
    "options": ["(3, 1)", "(1, 4)", "(3, 4)", "It is an error"],
    "answer": 2,
    "explain": "Each size-1 axis is stretched to match the other tensor, producing (3, 4)."
  },
  {
    "q": "Which expression is a true matrix product of a (2, 3) tensor a and a (3, 5) tensor b?",
    "options": ["a * b", "a + b", "a @ b", "a.mean(b)"],
    "answer": 2,
    "explain": "@ is matmul. The inner size 3 matches, giving a (2, 5) result. * is element-wise and would fail here."
  }
]
