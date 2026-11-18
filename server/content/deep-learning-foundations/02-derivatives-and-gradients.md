---
title: Derivatives and Gradients
xp: 25
---
## Slope as a signal

The **derivative** of a function at a point is its slope there: how much the output changes for a tiny change in the input. If `f(w) = w^2`, the derivative is `2w`: at `w = 3` the slope is 6, so nudging `w` up by 0.01 raises `f` by about 0.06.

## Why training needs it

A model's **loss** measures how wrong it is. If you know the slope of the loss with respect to each parameter, you know which way to push that parameter to make the loss smaller. That slope is the **gradient**.

## Many inputs: the gradient

For a function of several variables, the gradient is the vector of partial derivatives, one per input. Each entry answers: "holding the others fixed, how does the output change if only this one moves?" The gradient points toward steepest *increase*, so we step in the opposite direction.

## Checking numerically

You can estimate any derivative without calculus with a **finite difference**:

`f'(x) ≈ (f(x + h) - f(x - h)) / (2h)` for a small `h` such as `1e-3`.

This is slow for big models but is a great way to verify that autograd (or your hand-derived formula) is correct.

## Rules worth remembering

| Function | Derivative |
|----------|-----------|
| `w^n` | `n * w^(n-1)` |
| `c * w` | `c` |
| `a + b` | add derivatives |
| `f(g(w))` | `f'(g(w)) * g'(w)` (chain rule, next lessons) |

<!-- STARTER -->
import torch

def f(w):
    return w ** 3 - 2 * w          # derivative: 3w^2 - 2

w0 = 2.0
h = 1e-3
numeric = (f(torch.tensor(w0 + h)) - f(torch.tensor(w0 - h))) / (2 * h)
exact = 3 * w0 ** 2 - 2

w = torch.tensor(w0, requires_grad=True)
f(w).backward()
print(f"numeric={numeric.item():.4f}  by-hand={exact:.4f}  autograd={w.grad.item():.4f}")

# Gradient of a function of two variables: g(a, b) = a^2 * b
a = torch.tensor(3.0, requires_grad=True)
b = torch.tensor(4.0, requires_grad=True)
(a ** 2 * b).backward()
print("dg/da =", a.grad.item(), "(expect 2ab = 24)")
print("dg/db =", b.grad.item(), "(expect a^2 = 9)")

# Walking downhill on f(w) = (w - 3)^2
w = torch.tensor(0.0, requires_grad=True)
for step in range(5):
    loss = (w - 3) ** 2
    loss.backward()
    with torch.no_grad():
        w -= 0.3 * w.grad
    w.grad.zero_()
    print(f"step {step}: w={w.item():.3f} loss={loss.item():.3f}")

# Try it: change the step size 0.3 to 1.1 and watch what happens.
<!-- QUIZ -->
[
  {"q": "f(w) = w^2. What is the slope at w = 3?", "options": ["3", "6", "9", "2"], "answer": 1, "explain": "The derivative is 2w, which is 6 at w = 3."},
  {"q": "The gradient of the loss points toward steepest increase. How do we update parameters?", "options": ["Add the gradient", "Subtract a scaled gradient", "Ignore the sign", "Multiply by the gradient"], "answer": 1, "explain": "We step against the gradient to reduce the loss."},
  {"q": "What is a finite-difference check useful for?", "options": ["Speeding up training", "Verifying a derivative or autograd result numerically", "Choosing the batch size", "Saving models"], "answer": 1, "explain": "(f(x+h) - f(x-h)) / 2h approximates the derivative and catches mistakes in gradient code."}
]
