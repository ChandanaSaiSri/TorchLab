---
title: Implement Layer Normalization
difficulty: hard
category: Neural Networks
---
Write `layer_norm(x, eps=1e-5)` that normalises each vector along the **last dimension** to zero mean and unit variance:

`out = (x - mean) / sqrt(var + eps)`

- use the **biased** variance (divide by `N`, not `N-1`)
- no learnable scale/shift
- must work for any number of leading dimensions, e.g. `(B, D)` or `(B, T, D)`

Do not call `F.layer_norm` or `nn.LayerNorm`.
<!-- STARTER -->
import torch

def layer_norm(x, eps=1e-5):
    # TODO
    pass
<!-- SOLUTION -->
import torch

def layer_norm(x, eps=1e-5):
    mean = x.mean(dim=-1, keepdim=True)
    var = x.var(dim=-1, unbiased=False, keepdim=True)
    return (x - mean) / torch.sqrt(var + eps)
<!-- HINTS -->
Compute the mean and variance over `dim=-1` with `keepdim=True`, so they broadcast back against `x`.
===
`x.var(dim=-1, unbiased=False, keepdim=True)` gives the biased variance. Add `eps` before the square root.
<!-- TESTS -->
def test_matches_pytorch():
    torch.manual_seed(0)
    x = torch.randn(4, 16) * 5 + 3
    assert torch.allclose(layer_norm(x), F.layer_norm(x, (16,)), atol=1e-5)

def test_zero_mean_unit_variance():
    out = layer_norm(torch.randn(3, 32) * 10 + 4)
    assert torch.allclose(out.mean(dim=-1), torch.zeros(3), atol=1e-5), "mean should be ~0"
    assert torch.allclose(out.var(dim=-1, unbiased=False), torch.ones(3), atol=1e-3), "variance should be ~1"

def hidden_three_dims():
    x = torch.randn(2, 5, 8)
    assert torch.allclose(layer_norm(x), F.layer_norm(x, (8,)), atol=1e-5)

def hidden_gradient_flows():
    x = torch.randn(3, 6, requires_grad=True)
    layer_norm(x).pow(2).sum().backward()
    assert x.grad is not None and torch.isfinite(x.grad).all()

def hidden_no_builtin():
    assert not re.search(r"F\.layer_norm|LayerNorm|functional\.layer_norm", __source__), "write it yourself"

def hidden_constant_row():
    out = layer_norm(torch.full((1, 4), 7.0))
    assert torch.isfinite(out).all() and torch.allclose(out, torch.zeros(1, 4))
