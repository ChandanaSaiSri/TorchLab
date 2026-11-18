---
title: Backpropagation by Hand
difficulty: expert
category: Autograd
---
No autograd allowed. Write `manual_grads(x, y, W1, b1, W2, b2)` for this tiny network:

```
z1   = x @ W1 + b1          # (B, H)
h    = relu(z1)
pred = h @ W2 + b2          # (B, O)
loss = mean((pred - y)^2)   # mean over ALL B*O elements
```

Return the tuple `(dW1, db1, dW2, db2)`: the gradients of `loss` with respect to each parameter, computed with the chain rule using only ordinary tensor operations. Your result must match what autograd gives.

Do not call `.backward()`, `torch.autograd` or set `requires_grad`.
<!-- STARTER -->
import torch

def manual_grads(x, y, W1, b1, W2, b2):
    # TODO: forward pass, then work backwards with the chain rule
    pass
<!-- SOLUTION -->
import torch

def manual_grads(x, y, W1, b1, W2, b2):
    z1 = x @ W1 + b1
    h = z1.clamp(min=0)
    pred = h @ W2 + b2
    dpred = 2 * (pred - y) / pred.numel()
    dW2 = h.T @ dpred
    db2 = dpred.sum(dim=0)
    dh = dpred @ W2.T
    dz1 = dh * (z1 > 0)
    dW1 = x.T @ dz1
    db1 = dz1.sum(dim=0)
    return dW1, db1, dW2, db2
<!-- HINTS -->
Do the forward pass first and keep `z1`, `h` and `pred`. The loss derivative is `d loss / d pred = 2 * (pred - y) / pred.numel()`.
===
For `pred = h @ W2 + b2`: `dW2 = h.T @ dpred`, `db2 = dpred.sum(0)`, and the gradient flowing back into `h` is `dpred @ W2.T`.
===
ReLU passes the gradient only where `z1 > 0`: `dz1 = dh * (z1 > 0)`. Then repeat the same pattern for the first layer: `dW1 = x.T @ dz1`, `db1 = dz1.sum(0)`.
<!-- TESTS -->
def _setup(seed, B=6, I=4, H=5, O=3):
    g = torch.Generator().manual_seed(seed)
    x = torch.randn(B, I, generator=g)
    y = torch.randn(B, O, generator=g)
    W1 = torch.randn(I, H, generator=g); b1 = torch.randn(H, generator=g)
    W2 = torch.randn(H, O, generator=g); b2 = torch.randn(O, generator=g)
    return x, y, W1, b1, W2, b2

def _autograd(x, y, W1, b1, W2, b2):
    ps = [t.clone().requires_grad_(True) for t in (W1, b1, W2, b2)]
    pred = torch.relu(x @ ps[0] + ps[1]) @ ps[2] + ps[3]
    ((pred - y) ** 2).mean().backward()
    return [p.grad for p in ps]

def test_returns_four_tensors():
    out = manual_grads(*_setup(0))
    assert len(out) == 4, "return (dW1, db1, dW2, db2)"
    shapes = [tuple(t.shape) for t in out]
    assert shapes == [(4, 5), (5,), (5, 3), (3,)], f"shapes were {shapes}"

def test_matches_autograd():
    args = _setup(0)
    for name, mine, ref in zip(["dW1", "db1", "dW2", "db2"], manual_grads(*args), _autograd(*args)):
        assert torch.allclose(mine, ref, atol=1e-5), f"{name} does not match autograd"

def hidden_other_sizes():
    args = _setup(3, B=9, I=7, H=11, O=2)
    for mine, ref in zip(manual_grads(*args), _autograd(*args)):
        assert torch.allclose(mine, ref, atol=1e-5)

def hidden_no_autograd():
    assert not re.search(r"backward\(|autograd|requires_grad", __source__), "compute the gradients manually"

def hidden_relu_gate_matters():
    x, y, W1, b1, W2, b2 = _setup(5)
    b1 = b1 - 10.0   # makes many ReLUs inactive
    for mine, ref in zip(manual_grads(x, y, W1, b1, W2, b2), _autograd(x, y, W1, b1, W2, b2)):
        assert torch.allclose(mine, ref, atol=1e-5)
