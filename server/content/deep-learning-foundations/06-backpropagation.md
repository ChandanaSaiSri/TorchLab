---
title: Backpropagation and the Chain Rule
xp: 30
---
## How gradients get to every weight

A network is a chain of simple steps. **Backpropagation** applies the **chain rule** to that chain: to find how the loss depends on an early weight, multiply the local slopes of every step between that weight and the loss, working backwards.

## A worked example

Take a tiny network: `h = relu(w1 * x)`, `y = w2 * h`, `loss = (y - t)^2`, with `x = 2`, `w1 = 3`, `w2 = -1`, target `t = 1`.

Forward pass: `h = 6`, `y = -6`, `loss = 49`.

Backward pass, one local step at a time:

1. `dloss/dy = 2(y - t) = -14`
2. `dloss/dw2 = dloss/dy * dy/dw2 = -14 * h = -84`
3. `dloss/dh = dloss/dy * dy/dh = -14 * w2 = 14`
4. `dloss/dw1 = dloss/dh * dh/dw1 = 14 * x = 28` (ReLU passes the gradient through because its input was positive)

Autograd does exactly this bookkeeping for you on graphs with millions of operations. The forward pass stores the intermediate values it needs (like `h`), which is why training uses more memory than inference.

## Takeaways

- The gradient flowing back through a step is *incoming gradient x local slope*.
- ReLU's slope is 1 for positive inputs and 0 for negative ones, so a negative input blocks the gradient.
- Long chains of numbers smaller than 1 shrink toward zero (vanishing gradients); chains larger than 1 explode. Initialisation and architectures like residual connections exist to keep gradients healthy.

<!-- STARTER -->
import torch

x, t = 2.0, 1.0
w1 = torch.tensor(3.0, requires_grad=True)
w2 = torch.tensor(-1.0, requires_grad=True)

# Forward
h = torch.relu(w1 * x)
y = w2 * h
loss = (y - t) ** 2
print(f"h={h.item()}, y={y.item()}, loss={loss.item()}")

# Backward with autograd
loss.backward()
print("autograd  dL/dw2 =", w2.grad.item(), "| dL/dw1 =", w1.grad.item())

# Backward by hand with the chain rule
dL_dy = 2 * (y.item() - t)
dL_dw2 = dL_dy * h.item()
dL_dh = dL_dy * w2.item()
dL_dw1 = dL_dh * (1.0 if w1.item() * x > 0 else 0.0) * x
print("by hand   dL/dw2 =", dL_dw2, "| dL/dw1 =", dL_dw1)

# A negative pre-activation blocks the gradient
w1b = torch.tensor(-3.0, requires_grad=True)
loss_b = (w2 * torch.relu(w1b * x) - t) ** 2
loss_b.backward()
print("dead ReLU: dL/dw1 =", w1b.grad.item())

# Try it: set x = -2 with w1 = 3 so the ReLU input is negative. What is dL/dw1?
<!-- QUIZ -->
[
  {"q": "What does backpropagation apply to compute gradients through many layers?", "options": ["The quadratic formula", "The chain rule", "Random search", "Matrix inversion"], "answer": 1, "explain": "Each step's local slope is multiplied backwards along the chain."},
  {"q": "A ReLU received a negative input in the forward pass. What gradient flows back through it?", "options": ["1", "-1", "0", "Same as the input"], "answer": 2, "explain": "ReLU's slope is 0 for negative inputs, so it blocks the gradient."},
  {"q": "Why does training use more memory than inference?", "options": ["Larger batch sizes only", "Intermediate values from the forward pass are stored for the backward pass", "Gradients are never freed", "The loss is large"], "answer": 1, "explain": "Autograd keeps activations needed to compute local slopes during backward."}
]
