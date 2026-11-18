---
title: Meet the Tensor
xp: 20
---
## What is a tensor?

A **tensor** is a container of numbers arranged along some number of axes. It is the one data structure everything in PyTorch is built on: images, sentences, model weights and gradients are all tensors.

You already know the small cases:

| Name | Axes (`ndim`) | Example |
|------|---------------|---------|
| Scalar | 0 | a single number, `7` |
| Vector | 1 | a list of numbers, `[1, 2, 3]` |
| Matrix | 2 | a table with rows and columns |
| Tensor | 3 or more | a stack of matrices, e.g. a batch of images |

PyTorch uses the word "tensor" for all of them. What changes is how many axes there are.

## Three properties you will check constantly

- `shape`: the length of each axis, e.g. `(2, 3)` means 2 rows and 3 columns.
- `ndim`: how many axes there are (`len(shape)`).
- `dtype`: the type of the numbers. Most model math uses `torch.float32`; integer data such as class labels uses `torch.int64`.

Most beginner bugs are a wrong shape or a wrong dtype. Get into the habit of printing both.

## Creating tensors

```python
import torch

a = torch.tensor([1.0, 2.0, 3.0])   # from Python data
b = torch.zeros(2, 3)               # 2x3 of zeros
c = torch.ones(2, 3)                # 2x3 of ones
d = torch.arange(0, 10, 2)          # 0, 2, 4, 6, 8
e = torch.rand(2, 2)                # random numbers in [0, 1)
```

Random tensors differ on every run. Call `torch.manual_seed(42)` first when you want repeatable results.

## Your turn

Run the starter code, then edit it: change the numbers, make a 3-axis tensor, and watch how `shape` and `ndim` react.

<!-- STARTER -->
import torch

torch.manual_seed(42)

scalar = torch.tensor(7)
vector = torch.tensor([1.0, 2.0, 3.0])
matrix = torch.tensor([[1, 2, 3], [4, 5, 6]])
random = torch.rand(2, 3, 4)

for name, t in [("scalar", scalar), ("vector", vector), ("matrix", matrix), ("random", random)]:
    print(f"{name:7s} shape={tuple(t.shape)!s:10s} ndim={t.ndim} dtype={t.dtype}")

# Try it: what is the dtype of torch.tensor([1, 2, 3])? And of torch.tensor([1, 2.5, 3])?
<!-- QUIZ -->
[
  {
    "q": "What is the shape of torch.tensor([[1, 2, 3], [4, 5, 6]])?",
    "options": ["(3, 2)", "(2, 3)", "(6,)", "(2, 3, 1)"],
    "answer": 1,
    "explain": "Two inner lists (rows) of three numbers each gives shape (2, 3)."
  },
  {
    "q": "What does ndim tell you?",
    "options": ["How many numbers the tensor holds", "How many axes the tensor has", "The number type", "The device it lives on"],
    "answer": 1,
    "explain": "ndim is the number of axes, i.e. len(tensor.shape). A scalar has 0, a vector 1, a matrix 2."
  },
  {
    "q": "Why would you call torch.manual_seed(42) before creating random tensors?",
    "options": ["To make them faster", "To make the random values repeatable", "To make them integers", "To move them to the GPU"],
    "answer": 1,
    "explain": "Seeding fixes the random number generator so you get the same values on every run."
  }
]
