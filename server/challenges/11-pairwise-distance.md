---
title: Pairwise Distances
difficulty: medium
category: Broadcasting
---
Write `pairwise_dist(a, b)` where `a` has shape `(n, d)` and `b` has shape `(m, d)`. Return an `(n, m)` matrix whose `[i, j]` entry is the **Euclidean distance** between `a[i]` and `b[j]`.

Use broadcasting only: no Python loops and no `torch.cdist`.
<!-- STARTER -->
import torch

def pairwise_dist(a, b):
    # TODO
    pass
<!-- SOLUTION -->
import torch

def pairwise_dist(a, b):
    diff = a.unsqueeze(1) - b.unsqueeze(0)
    return diff.pow(2).sum(dim=-1).sqrt()
<!-- HINTS -->
Give `a` the shape `(n, 1, d)` and `b` the shape `(1, m, d)` with `unsqueeze`.
===
Subtracting them broadcasts to `(n, m, d)`. Square, sum over the last dimension, then take the square root.
<!-- TESTS -->
def test_matches_cdist():
    torch.manual_seed(0)
    a, b = torch.randn(5, 3), torch.randn(4, 3)
    out = pairwise_dist(a, b)
    assert out.shape == (5, 4), f"expected (5, 4), got {tuple(out.shape)}"
    assert torch.allclose(out, torch.cdist(a, b), atol=1e-5)

def test_simple_points():
    a = torch.tensor([[0., 0.]])
    b = torch.tensor([[3., 4.], [0., 1.]])
    assert torch.allclose(pairwise_dist(a, b), torch.tensor([[5., 1.]]))

def hidden_no_loops_or_cdist():
    assert not re.search(r"cdist|^\s*for\s", __source__, re.M), "use broadcasting"

def hidden_self_distance():
    a = torch.randn(6, 4)
    d = pairwise_dist(a, a)
    assert torch.allclose(d.diagonal(), torch.zeros(6), atol=1e-4) and torch.allclose(d, d.T, atol=1e-5)
