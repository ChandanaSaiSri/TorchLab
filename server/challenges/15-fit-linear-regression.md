---
title: Fit a Linear Model by Gradient Descent
difficulty: hard
category: Optimization & Training
---
Write `fit_linear(X, y, lr=0.1, steps=200)`:

- `X`: `(n, d)` features, `y`: `(n,)` targets
- start from `w = zeros(d)` and `b = 0`
- run `steps` iterations of gradient descent on the mean squared error of `X @ w + b`
- return `(w, b)` as detached tensors (`w` of shape `(d,)`, `b` a scalar)

Use autograd. Closed-form solvers (`lstsq`, `pinverse`, `linalg.*`) are not allowed: the point is to practise the training loop.
<!-- STARTER -->
import torch

def fit_linear(X, y, lr=0.1, steps=200):
    # TODO
    pass
<!-- SOLUTION -->
import torch

def fit_linear(X, y, lr=0.1, steps=200):
    w = torch.zeros(X.shape[1], requires_grad=True)
    b = torch.zeros((), requires_grad=True)
    for _ in range(steps):
        loss = ((X @ w + b - y) ** 2).mean()
        loss.backward()
        with torch.no_grad():
            w -= lr * w.grad
            b -= lr * b.grad
        w.grad.zero_()
        b.grad.zero_()
    return w.detach(), b.detach()
<!-- HINTS -->
Create `w` and `b` with `requires_grad=True`. Each step: compute the loss, call `loss.backward()`, update with `torch.no_grad()`, and reset the gradients.
===
Forgetting to zero the gradients makes them accumulate across steps; the update `w -= lr * w.grad` must happen inside `torch.no_grad()`.
<!-- TESTS -->
def _data(seed, n=200):
    g = torch.Generator().manual_seed(seed)
    X = torch.randn(n, 3, generator=g)
    true_w = torch.tensor([2.0, -1.0, 0.5])
    y = X @ true_w + 1.0 + 0.05 * torch.randn(n, generator=g)
    return X, y

def test_shapes():
    X, y = _data(0)
    w, b = fit_linear(X, y)
    assert w.shape == (3,), f"w should have shape (3,), got {tuple(w.shape)}"
    assert b.dim() == 0, "b should be a scalar tensor"
    assert not w.requires_grad, "return detached tensors"

def test_recovers_weights():
    X, y = _data(0)
    w, b = fit_linear(X, y)
    assert torch.allclose(w, torch.tensor([2.0, -1.0, 0.5]), atol=0.1), f"w = {w.tolist()}"
    assert abs(b.item() - 1.0) < 0.1, f"b = {b.item():.3f}"

def hidden_other_dataset():
    X, y = _data(7, n=500)
    w, b = fit_linear(X, y, lr=0.05, steps=300)
    assert torch.allclose(w, torch.tensor([2.0, -1.0, 0.5]), atol=0.1) and abs(b.item() - 1.0) < 0.1

def hidden_no_closed_form():
    assert not re.search(r"lstsq|pinverse|pinv|linalg|solve", __source__), "use gradient descent, not a closed-form solver"

def hidden_zero_steps_stays_at_zero():
    X, y = _data(1)
    w, b = fit_linear(X, y, steps=0)
    assert torch.count_nonzero(w) == 0 and b.item() == 0
