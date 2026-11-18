---
title: Gradient of a Function
difficulty: easy
category: Autograd
---
Write `grad_of(f, x)`. `f` is a function that takes a tensor and returns a **scalar** tensor. Return the gradient of `f` at `x`, as a tensor with the same shape as `x`, computed with autograd.

Do not modify the tensor that was passed in; work on a copy.

```python
grad_of(lambda x: (x ** 2).sum(), torch.tensor([1., 2., 3.]))
# tensor([2., 4., 6.])
```
<!-- STARTER -->
import torch

def grad_of(f, x):
    # TODO
    pass
<!-- SOLUTION -->
import torch

def grad_of(f, x):
    x = x.detach().clone().requires_grad_(True)
    f(x).backward()
    return x.grad
<!-- HINTS -->
A tensor only collects gradients if `requires_grad=True`. Make a copy first with `x.detach().clone()`.
===
Call `f(x_copy).backward()`, then read `x_copy.grad`.
<!-- TESTS -->
def test_square():
    out = grad_of(lambda x: (x ** 2).sum(), torch.tensor([1., 2., 3.]))
    assert torch.allclose(out, torch.tensor([2., 4., 6.])), f"got {out}"

def test_input_not_modified():
    x = torch.tensor([1., 2.])
    grad_of(lambda t: (t * 3).sum(), x)
    assert x.grad is None and not x.requires_grad, "the tensor passed in must stay untouched"

def hidden_sin():
    x = torch.linspace(-2, 2, 7)
    out = grad_of(lambda t: torch.sin(t).sum(), x)
    assert torch.allclose(out, torch.cos(x), atol=1e-6)

def hidden_matrix_input():
    x = torch.randn(3, 4)
    out = grad_of(lambda t: (t @ t.T).trace(), x)
    assert out.shape == x.shape and torch.allclose(out, 2 * x, atol=1e-5)
