---
title: Mean Squared Error
difficulty: easy
category: Loss Functions
---
Write `mse(pred, target)` that returns the **mean squared error** as a scalar tensor: the average of `(pred - target)^2` over all elements.

It must stay differentiable, so that `loss.backward()` works when `pred` requires gradients.
<!-- STARTER -->
import torch

def mse(pred, target):
    # TODO
    pass
<!-- SOLUTION -->
import torch

def mse(pred, target):
    return ((pred - target) ** 2).mean()
<!-- HINTS -->
Subtract, square, then average. Plain tensor operations are all tracked by autograd.
<!-- TESTS -->
def test_matches_pytorch():
    p, t = torch.randn(8, 3), torch.randn(8, 3)
    assert torch.allclose(mse(p, t), F.mse_loss(p, t), atol=1e-6)

def test_scalar():
    assert mse(torch.randn(5), torch.randn(5)).dim() == 0, "return a scalar (0-dim) tensor"

def hidden_gradient():
    p = torch.randn(6, requires_grad=True)
    t = torch.randn(6)
    mse(p, t).backward()
    assert torch.allclose(p.grad, 2 * (p.detach() - t) / 6, atol=1e-6)

def hidden_perfect_prediction():
    x = torch.randn(4, 4)
    assert mse(x, x.clone()).item() == 0.0
