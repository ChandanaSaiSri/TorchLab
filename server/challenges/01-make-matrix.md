---
title: Make a Matrix
difficulty: easy
category: Tensor Basics
---
Write `make_matrix(rows, cols)` that returns a **float32** tensor of shape `(rows, cols)` whose element at position `(i, j)` equals `i * cols + j`.

```python
make_matrix(2, 3)
# tensor([[0., 1., 2.],
#         [3., 4., 5.]])
```
<!-- STARTER -->
import torch

def make_matrix(rows, cols):
    # TODO: return a (rows, cols) float32 tensor counting up row by row
    pass
<!-- SOLUTION -->
import torch

def make_matrix(rows, cols):
    return torch.arange(rows * cols, dtype=torch.float32).reshape(rows, cols)
<!-- HINTS -->
`torch.arange(n)` makes the sequence 0, 1, ..., n-1.
===
Count up `rows * cols` numbers, then change the shape with `.reshape(rows, cols)`. Remember `dtype=torch.float32`.
<!-- TESTS -->
def test_shape_and_dtype():
    m = make_matrix(2, 3)
    assert isinstance(m, torch.Tensor), "return a torch.Tensor"
    assert m.shape == (2, 3), f"expected shape (2, 3), got {tuple(m.shape)}"
    assert m.dtype == torch.float32, f"expected float32, got {m.dtype}"

def test_values():
    expected = torch.tensor([[0., 1., 2.], [3., 4., 5.]])
    assert torch.equal(make_matrix(2, 3), expected), "values should count up row by row"

def hidden_larger():
    m = make_matrix(7, 5)
    assert m.shape == (7, 5) and m[6, 4] == 34 and m[3, 2] == 17

def hidden_single():
    assert torch.equal(make_matrix(1, 1), torch.zeros(1, 1))
