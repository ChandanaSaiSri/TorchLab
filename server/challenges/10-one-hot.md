---
title: One-Hot Encoding with scatter
difficulty: medium
category: Indexing & Reshaping
---
Write `one_hot(labels, n)`:

- `labels`: long tensor `(B,)` with values in `0..n-1`
- returns a **float** tensor `(B, n)` with a `1.0` at each row's label position and `0.0` elsewhere

Do not use `F.one_hot`. Use indexing or `scatter_`.

```python
one_hot(torch.tensor([2, 0]), 3)
# tensor([[0., 0., 1.],
#         [1., 0., 0.]])
```
<!-- STARTER -->
import torch

def one_hot(labels, n):
    # TODO
    pass
<!-- SOLUTION -->
import torch

def one_hot(labels, n):
    out = torch.zeros(labels.shape[0], n)
    out.scatter_(1, labels.unsqueeze(1), 1.0)
    return out
<!-- HINTS -->
Start from `torch.zeros(B, n)`.
===
`out.scatter_(dim, index, value)` writes `value` into `out` at the positions named by `index` along `dim`. Here `dim=1` and the index must have shape `(B, 1)`.
<!-- TESTS -->
def test_example():
    out = one_hot(torch.tensor([2, 0]), 3)
    assert torch.equal(out, torch.tensor([[0., 0., 1.], [1., 0., 0.]])), f"got {out.tolist()}"

def test_dtype_and_shape():
    out = one_hot(torch.tensor([0, 1, 2, 3]), 5)
    assert out.shape == (4, 5) and out.dtype == torch.float32

def hidden_matches_functional():
    labels = torch.randint(0, 7, (20,))
    assert torch.equal(one_hot(labels, 7), F.one_hot(labels, 7).float())

def hidden_no_functional():
    assert not re.search(r"F\.one_hot|functional\.one_hot", __source__), "do not call F.one_hot"
