---
title: Gradient Descent by Hand
xp: 25
---
## Learning as a loop

Suppose the true rule behind some data is `y = 2x + 1`, but your model does not know that. It starts with a guess `y = w*x + b` with random-ish `w` and `b`, and improves them step by step:

1. **Predict** with the current `w` and `b`.
2. **Measure the error** with a loss. We use mean squared error (MSE): the average of `(prediction - truth)^2`. It is zero for a perfect fit and grows as predictions drift.
3. **Compute gradients** of the loss with respect to `w` and `b` (autograd does this).
4. **Update** each parameter a small step *against* its gradient: `w = w - lr * w.grad`.
5. Repeat.

`lr`, the **learning rate**, controls the step size. Too small and learning crawls; too large and the loss bounces around or explodes. Values like `0.01` to `0.1` are a good place to start for this toy problem.

## Updating without tracking

The update itself is not part of the model, so do it inside `torch.no_grad()` and then zero the gradients:

```python
with torch.no_grad():
    w -= lr * w.grad
    b -= lr * b.grad
w.grad.zero_()
b.grad.zero_()
```

Watch the loss fall in the starter code, and watch `w` and `b` approach 2 and 1.

<!-- STARTER -->
import torch

torch.manual_seed(0)

# Data from the "secret" rule y = 2x + 1
x = torch.linspace(-1, 1, 50)
y = 2 * x + 1

# Parameters to learn
w = torch.tensor(0.0, requires_grad=True)
b = torch.tensor(0.0, requires_grad=True)

lr = 0.1
for step in range(101):
    pred = w * x + b
    loss = ((pred - y) ** 2).mean()   # MSE

    loss.backward()

    with torch.no_grad():
        w -= lr * w.grad
        b -= lr * b.grad
    w.grad.zero_()
    b.grad.zero_()

    if step % 20 == 0:
        print(f"step {step:3d}  loss={loss.item():.5f}  w={w.item():.3f}  b={b.item():.3f}")

# Try it: set lr = 1.5. What happens to the loss? Then try lr = 0.001.
<!-- QUIZ -->
[
  {
    "q": "In gradient descent, which way do we move each parameter?",
    "options": ["Along the gradient", "Against the gradient", "Randomly", "Toward zero always"],
    "answer": 1,
    "explain": "The gradient points toward increasing loss, so we subtract it (scaled by the learning rate)."
  },
  {
    "q": "Your loss grows larger every step and eventually becomes inf. The most likely cause?",
    "options": ["The learning rate is too large", "The learning rate is too small", "You forgot to import torch", "The dataset is too small"],
    "answer": 0,
    "explain": "Overly large steps overshoot the minimum and diverge. Lower the learning rate."
  },
  {
    "q": "Why is the parameter update wrapped in torch.no_grad()?",
    "options": ["To make it run on GPU", "So the update itself is not recorded in the autograd graph", "To zero the gradients", "To convert tensors to floats"],
    "answer": 1,
    "explain": "The update is bookkeeping, not part of the model's computation, so it should not be tracked."
  }
]
