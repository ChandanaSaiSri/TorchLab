---
title: Center the Columns
difficulty: easy
category: Broadcasting
---
Write `center(x)` that subtracts each **column's mean** from that column of a 2-D tensor `x` (shape `(n, d)`). The result has the same shape, and every column then averages to 0.

Do it in one line with broadcasting, with no loops.
<!-- STARTER -->
import torch

def center(x):
    # TODO
    pass
<!-- SOLUTION -->
import torch

def center(x):
    return x - x.mean(dim=0, keepdim=True)
<!-- HINTS -->
`x.mean(dim=0)` averages over the rows, giving one mean per column.
===
Use `keepdim=True` so the mean has shape `(1, d)`; then `x - mean` broadcasts across all rows.
<!-- TESTS -->
def test_columns_average_zero():
    x = torch.randn(10, 4) * 3 + 7
    out = center(x)
    assert out.shape == x.shape, "shape must not change"
    assert torch.allclose(out.mean(dim=0), torch.zeros(4), atol=1e-5), "each column should average to 0"

def test_known_values():
    x = torch.tensor([[1., 10.], [3., 20.]])
    assert torch.allclose(center(x), torch.tensor([[-1., -5.], [1., 5.]]))

def hidden_no_loops():
    assert not re.search(r"^\s*for\s", __source__, re.M), "use broadcasting instead of a loop"

def hidden_original_untouched():
    x = torch.randn(5, 3)
    before = x.clone()
    center(x)
    assert torch.equal(x, before), "do not modify the input in place"
