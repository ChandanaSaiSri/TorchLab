---
title: Implement the Adam Optimizer
difficulty: expert
category: Optimization & Training
---
Write a class `MyAdam` that behaves like `torch.optim.Adam`:

```python
opt = MyAdam(params, lr=1e-3, betas=(0.9, 0.999), eps=1e-8)
opt.zero_grad()   # set every parameter's grad to None (or zero)
opt.step()        # one update using the current .grad values
```

For each parameter, at step `t` (starting at 1):

```
m = b1 * m + (1 - b1) * g
v = b2 * v + (1 - b2) * g * g
m_hat = m / (1 - b1**t)
v_hat = v / (1 - b2**t)
p = p - lr * m_hat / (sqrt(v_hat) + eps)
```

`params` may be a generator, so store it as a list. Skip parameters whose gradient is `None`. Your updates must match PyTorch's to within `1e-6` over many steps. Do not use `torch.optim`.
<!-- STARTER -->
import torch

class MyAdam:
    def __init__(self, params, lr=1e-3, betas=(0.9, 0.999), eps=1e-8):
        # TODO
        pass

    def zero_grad(self):
        # TODO
        pass

    def step(self):
        # TODO
        pass
<!-- SOLUTION -->
import torch

class MyAdam:
    def __init__(self, params, lr=1e-3, betas=(0.9, 0.999), eps=1e-8):
        self.params = list(params)
        self.lr, self.b1, self.b2, self.eps = lr, betas[0], betas[1], eps
        self.m = [torch.zeros_like(p) for p in self.params]
        self.v = [torch.zeros_like(p) for p in self.params]
        self.t = 0

    def zero_grad(self):
        for p in self.params:
            p.grad = None

    @torch.no_grad()
    def step(self):
        self.t += 1
        for i, p in enumerate(self.params):
            if p.grad is None:
                continue
            g = p.grad
            self.m[i].mul_(self.b1).add_(g, alpha=1 - self.b1)
            self.v[i].mul_(self.b2).addcmul_(g, g, value=1 - self.b2)
            m_hat = self.m[i] / (1 - self.b1 ** self.t)
            v_hat = self.v[i] / (1 - self.b2 ** self.t)
            p -= self.lr * m_hat / (v_hat.sqrt() + self.eps)
<!-- HINTS -->
Keep per-parameter state: lists `m` and `v` of zeros shaped like each parameter, and a step counter `t` that increases once per `step()` call.
===
Do the update inside `torch.no_grad()` (decorate `step` with `@torch.no_grad()`), and update `p` in place with `p -= ...`.
===
Bias correction uses the step counter: `1 - beta ** t`. Make sure `t` is incremented before it is used (the first step has `t = 1`).
<!-- TESTS -->
def _run(opt_cls, steps=25, **kw):
    torch.manual_seed(0)
    w = torch.randn(5, requires_grad=True)
    b = torch.randn(1, requires_grad=True)
    opt = opt_cls([w, b], **kw)
    x = torch.randn(20, 5)
    y = torch.randn(20)
    for _ in range(steps):
        opt.zero_grad()
        loss = ((x @ w + b - y) ** 2).mean()
        loss.backward()
        opt.step()
    return w.detach(), b.detach()

def test_matches_torch_adam():
    mw, mb = _run(MyAdam, lr=0.05)
    tw, tb = _run(torch.optim.Adam, lr=0.05)
    assert torch.allclose(mw, tw, atol=1e-6) and torch.allclose(mb, tb, atol=1e-6), "parameters differ from torch.optim.Adam"

def test_first_step_size():
    w = torch.tensor([1.0], requires_grad=True)
    opt = MyAdam([w], lr=0.1)
    (w * 5).sum().backward()
    opt.step()
    assert abs(w.item() - 0.9) < 1e-6, f"after one step w should be 0.9, got {w.item():.6f}"

def hidden_other_hyperparameters():
    mw, mb = _run(MyAdam, steps=40, lr=0.01, betas=(0.8, 0.9), eps=1e-6)
    tw, tb = _run(torch.optim.Adam, steps=40, lr=0.01, betas=(0.8, 0.9), eps=1e-6)
    assert torch.allclose(mw, tw, atol=1e-6) and torch.allclose(mb, tb, atol=1e-6)

def hidden_skips_params_without_grad():
    a = torch.tensor([1.0], requires_grad=True)
    b = torch.tensor([2.0], requires_grad=True)
    opt = MyAdam((p for p in [a, b]), lr=0.1)
    (a * 3).sum().backward()
    opt.step()
    assert b.item() == 2.0 and a.item() != 1.0

def hidden_no_torch_optim():
    assert not re.search(r"optim\.", __source__), "do not use torch.optim in your solution"
