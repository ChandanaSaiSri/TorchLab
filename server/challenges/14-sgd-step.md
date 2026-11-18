---
title: Write an SGD Step
difficulty: medium
category: Optimization & Training
---
Write `sgd_step(params, lr)` that performs one step of plain gradient descent by hand:

1. for every parameter that has a gradient, update it in place: `p = p - lr * p.grad`
2. then set that parameter's gradient back to zero (in place)

Parameters without a gradient (`p.grad is None`) must be skipped. `params` may be a generator, so loop over it only once. The parameters must remain trainable leaf tensors afterwards.
<!-- STARTER -->
import torch

def sgd_step(params, lr):
    # TODO
    pass
<!-- SOLUTION -->
import torch

def sgd_step(params, lr):
    with torch.no_grad():
        for p in params:
            if p.grad is None:
                continue
            p -= lr * p.grad
            p.grad.zero_()
<!-- HINTS -->
Changing a tensor that requires grad in place raises an error unless autograd is switched off: wrap the loop in `with torch.no_grad():`.
===
`p -= lr * p.grad` updates in place (keeps the same tensor object). Then call `p.grad.zero_()`.
<!-- TESTS -->
def test_single_update():
    w = torch.tensor([1., 2.], requires_grad=True)
    (w ** 2).sum().backward()
    sgd_step([w], 0.1)
    assert torch.allclose(w.detach(), torch.tensor([0.8, 1.6])), f"got {w.tolist()}"

def test_gradients_zeroed():
    w = torch.tensor([1., 2.], requires_grad=True)
    (w ** 2).sum().backward()
    sgd_step([w], 0.1)
    assert w.grad is not None and torch.count_nonzero(w.grad) == 0, "zero the gradients after the update"

def test_still_trainable():
    w = torch.tensor([1.], requires_grad=True)
    (w * 3).sum().backward()
    sgd_step([w], 0.5)
    assert w.requires_grad and w.is_leaf, "w must remain a trainable leaf tensor"

def hidden_skips_missing_grad_and_generators():
    a = torch.tensor([1.], requires_grad=True)
    b = torch.tensor([5.], requires_grad=True)
    (a * 2).sum().backward()
    sgd_step((p for p in [a, b]), 0.5)
    assert torch.allclose(a.detach(), torch.tensor([0.])) and torch.allclose(b.detach(), torch.tensor([5.]))

def hidden_actually_minimises():
    w = torch.tensor([3.0], requires_grad=True)
    for _ in range(50):
        (w ** 2).sum().backward()
        sgd_step([w], 0.1)
    assert abs(w.item()) < 0.01
