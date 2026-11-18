---
title: Autograd - Automatic Gradients
xp: 25
---
## The idea

Training a model means nudging its numbers (the **parameters**) so a **loss** gets smaller. To nudge in the right direction you need the **gradient**: how much the loss changes if each parameter changes a little. Working these out by hand for a big model is impractical, so PyTorch records the operations you perform and replays them backwards to compute every gradient for you. This is **autograd**.

## The three steps

1. Mark a tensor as trainable: `w = torch.tensor(3.0, requires_grad=True)`.
2. Compute something from it. PyTorch builds a graph of the operations as you go.
3. Call `.backward()` on a scalar result. The gradient lands in `w.grad`.

```python
w = torch.tensor(3.0, requires_grad=True)
y = w ** 2 + 2 * w      # y = w^2 + 2w
y.backward()
print(w.grad)           # dy/dw = 2w + 2 = 8
```

## Things that trip people up

- **Gradients accumulate.** Calling `backward()` again *adds* to `.grad`. In training you reset them every step (`w.grad.zero_()`, or `optimizer.zero_grad()` which you will meet soon).
- `backward()` needs a **scalar**. For a vector result, reduce it first with `.sum()` or `.mean()`.
- Use `with torch.no_grad():` when you only want to use a model (or update weights by hand) without building a graph. It is faster and saves memory.
- `.detach()` returns a tensor cut loose from the graph, handy before converting to NumPy.

## Your turn

The starter checks autograd against a derivative worked out on paper. Change the function and verify the answer yourself.

<!-- STARTER -->
import torch

# y = w^2 + 2w  ->  dy/dw = 2w + 2
w = torch.tensor(3.0, requires_grad=True)
y = w ** 2 + 2 * w
y.backward()
print("autograd:", w.grad.item(), "| by hand:", 2 * 3.0 + 2)

# Gradients accumulate - run backward a second time
y = w ** 2 + 2 * w
y.backward()
print("after 2nd backward (accumulated):", w.grad.item())

w.grad.zero_()
print("after zeroing:", w.grad.item())

# Multiple inputs: z = a*b + b^2
a = torch.tensor(2.0, requires_grad=True)
b = torch.tensor(5.0, requires_grad=True)
z = a * b + b ** 2
z.backward()
print("dz/da =", a.grad.item(), "(expect b = 5)")
print("dz/db =", b.grad.item(), "(expect a + 2b = 12)")

# Try it: compute the gradient of sin(w) at w = 0 and check it equals cos(0) = 1.
<!-- QUIZ -->
[
  {
    "q": "What does setting requires_grad=True on a tensor do?",
    "options": ["Moves it to the GPU", "Tells PyTorch to track operations on it so gradients can be computed", "Makes it immutable", "Converts it to integers"],
    "answer": 1,
    "explain": "It switches on tracking, so a later .backward() can fill in the tensor's .grad."
  },
  {
    "q": "You call loss.backward() twice without zeroing gradients. What happens to w.grad?",
    "options": ["It is overwritten", "The new gradient is added to the old one", "It is reset to None", "PyTorch raises an error"],
    "answer": 1,
    "explain": "Gradients accumulate by default, which is why training loops zero them every iteration."
  },
  {
    "q": "If w = 3.0 and y = w**2 + 2*w, what is w.grad after y.backward()?",
    "options": ["6.0", "8.0", "15.0", "2.0"],
    "answer": 1,
    "explain": "dy/dw = 2w + 2 = 2*3 + 2 = 8."
  }
]
