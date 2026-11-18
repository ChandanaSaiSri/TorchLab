---
title: Rows Above a Threshold
difficulty: easy
category: Indexing & Reshaping
---
Given a 2-D tensor `x` and a number `t`, return only the **rows whose sum is greater than `t`**, keeping their original order.

```python
x = torch.tensor([[1., 2.], [-5., 1.], [3., 3.]])
rows_above(x, 2)
# tensor([[1., 2.],
#         [3., 3.]])
```
If no row qualifies, return a tensor of shape `(0, x.shape[1])`.
<!-- STARTER -->
import torch

def rows_above(x, t):
    # TODO
    pass
<!-- SOLUTION -->
import torch

def rows_above(x, t):
    return x[x.sum(dim=1) > t]
<!-- HINTS -->
`x.sum(dim=1)` gives one number per row.
===
Comparing it with `t` gives a boolean mask. Indexing with a mask, `x[mask]`, keeps the rows where it is `True`.
<!-- TESTS -->
def test_example():
    x = torch.tensor([[1., 2.], [-5., 1.], [3., 3.]])
    out = rows_above(x, 2)
    assert torch.equal(out, torch.tensor([[1., 2.], [3., 3.]])), f"got {out.tolist()}"

def test_keeps_all_columns():
    x = torch.arange(12.).reshape(3, 4)
    assert rows_above(x, 10).shape == (2, 4)

def hidden_none_qualify():
    out = rows_above(torch.ones(3, 2), 100)
    assert out.shape == (0, 2)

def hidden_order_preserved():
    x = torch.tensor([[5., 5.], [1., 1.], [9., 0.], [0., 0.]])
    assert torch.equal(rows_above(x, 4), torch.tensor([[5., 5.], [9., 0.]]))
