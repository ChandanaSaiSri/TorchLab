---
title: Shapes and Indexing
xp: 20
---
## Why shapes matter

Layers, loss functions and matrix multiplications all demand specific shapes. Fluency with reshaping and indexing saves hours of debugging.

## Reshaping

`reshape` rearranges the same numbers into a new shape. The total count must stay the same, and one dimension may be `-1` meaning "work it out for me".

```python
x = torch.arange(12)          # shape (12,)
x.reshape(3, 4)               # 3 rows, 4 columns
x.reshape(2, -1)              # (2, 6)
```

Related tools:

- `unsqueeze(dim)` adds a length-1 axis; `squeeze()` removes length-1 axes.
- `permute(2, 0, 1)` reorders axes, for example turning an image from height-width-channel into channel-height-width.
- `flatten()` collapses everything into one axis.

## Indexing and slicing

Indexing follows Python lists, with one comma-separated index per axis:

```python
m = torch.arange(12).reshape(3, 4)
m[0]        # first row
m[:, 1]     # second column (every row, column 1)
m[1:, :2]   # rows 1.., columns 0-1
m[-1, -1]   # last element
```

You can also filter with a boolean mask: `m[m > 5]` returns a 1-D tensor of the values greater than 5.

A **view** shares memory with the original. Changing a slice changes the tensor it came from; call `.clone()` when you want an independent copy.

<!-- STARTER -->
import torch

x = torch.arange(24)
print("flat:", x.shape)

cube = x.reshape(2, 3, 4)
print("cube:", cube.shape)
print("first block:\n", cube[0])
print("last column of every row in block 1:", cube[1, :, -1])

# Add a batch axis, then move the last axis to the front
batched = cube.unsqueeze(0)
print("unsqueeze:", batched.shape)
print("permute:", batched.permute(0, 3, 1, 2).shape)

# Views share memory!
row = cube[0, 0]
row[0] = 999
print("original changed too:", cube[0, 0, 0].item())

# Try it: use a boolean mask to pull out all values of `x` that are divisible by 5.
<!-- QUIZ -->
[
  {
    "q": "x has shape (12,). What shape does x.reshape(3, -1) give?",
    "options": ["(3, 12)", "(3, 4)", "(4, 3)", "It raises an error"],
    "answer": 1,
    "explain": "-1 is inferred so the total stays 12: 12 / 3 = 4, giving (3, 4)."
  },
  {
    "q": "For m with shape (3, 4), what does m[:, 1] return?",
    "options": ["The second row", "The second column, shape (3,)", "The first two rows", "A single number"],
    "answer": 1,
    "explain": "':' keeps every row and 1 picks column index 1, leaving a vector of 3 values."
  },
  {
    "q": "You modify a slice of a tensor and the original changes too. Why?",
    "options": ["A bug in PyTorch", "Slices are views that share memory", "reshape always copies", "The dtype changed"],
    "answer": 1,
    "explain": "Basic slicing returns a view onto the same memory. Use .clone() for an independent copy."
  }
]
