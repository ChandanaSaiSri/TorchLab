---
title: Numerically Stable Softmax
difficulty: medium
category: Loss Functions
---
Implement `softmax(x)` along the **last dimension** yourself. Do not call `torch.softmax`, `F.softmax` or `.softmax()`.

A naive `exp(x) / exp(x).sum()` overflows for large inputs: `exp(1000)` is `inf`, and you get `nan`. Your version must give correct, finite results even for `[1000., 1001., 1002.]`.
<!-- STARTER -->
import torch

def softmax(x):
    # TODO
    pass
<!-- SOLUTION -->
import torch

def softmax(x):
    shifted = x - x.max(dim=-1, keepdim=True).values
    e = shifted.exp()
    return e / e.sum(dim=-1, keepdim=True)
<!-- HINTS -->
Softmax does not change if you subtract the same number from every element of a row.
===
Subtract the row maximum first, so the largest value becomes 0 and `exp` never exceeds 1. Use `keepdim=True` so the shapes broadcast.
<!-- TESTS -->
def test_matches_pytorch():
    x = torch.randn(4, 6)
    assert torch.allclose(softmax(x), torch.softmax(x, dim=-1), atol=1e-6)

def test_rows_sum_to_one():
    out = softmax(torch.randn(3, 5))
    assert torch.allclose(out.sum(dim=-1), torch.ones(3), atol=1e-6)

def test_large_values_are_finite():
    out = softmax(torch.tensor([[1000., 1001., 1002.]]))
    assert torch.isfinite(out).all(), "got inf/nan: subtract the maximum before exp"
    assert torch.allclose(out, torch.softmax(torch.tensor([[1000., 1001., 1002.]]), dim=-1), atol=1e-6)

def hidden_no_builtin():
    assert not re.search(r"\.softmax\(|F\.softmax|log_softmax", __source__.replace("def softmax", "")), "implement it yourself"

def hidden_3d_input():
    x = torch.randn(2, 3, 4)
    assert torch.allclose(softmax(x), torch.softmax(x, dim=-1), atol=1e-6)

def hidden_very_negative():
    out = softmax(torch.tensor([-1000., -1000., -999.]))
    assert torch.isfinite(out).all() and abs(out.sum().item() - 1) < 1e-6
