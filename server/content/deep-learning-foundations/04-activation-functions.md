---
title: Activation Functions
xp: 25
---
## Adding the bend

An activation function is applied to a neuron's output so the network can model non-linear patterns. The common ones:

| Name | Formula (idea) | Output range | Typical use |
|------|----------------|--------------|-------------|
| **ReLU** | `max(0, x)` | 0 to infinity | Default for hidden layers |
| **Sigmoid** | `1 / (1 + e^-x)` | 0 to 1 | Binary probability (output) |
| **Tanh** | like sigmoid, centred | -1 to 1 | Some sequence models |
| **GELU** | smooth ReLU-like | about -0.17 to infinity | Transformers |
| **Softmax** | `e^xi / sum(e^xj)` | each 0 to 1, sums to 1 | Multi-class probabilities |

## Practical notes

- **ReLU** is cheap and works well, but a neuron whose input is always negative outputs 0 and receives zero gradient (a "dead" ReLU). `LeakyReLU` keeps a small slope for negatives.
- **Sigmoid/tanh saturate**: for large positive or negative inputs the curve is flat, so the gradient is near 0. In deep stacks these tiny gradients multiply and training stalls: the **vanishing gradient** problem.
- **Softmax** turns a vector of raw scores (**logits**) into a probability distribution. It acts across the class dimension, so use `dim=-1`.
- Output layers often have *no* activation in PyTorch: loss functions like `CrossEntropyLoss` and `BCEWithLogitsLoss` apply the right one internally, which is more numerically stable.

<!-- STARTER -->
import torch
import torch.nn.functional as F

x = torch.tensor([-3.0, -1.0, 0.0, 1.0, 3.0])
print("input  :", x)
print("relu   :", F.relu(x))
print("sigmoid:", torch.sigmoid(x).round(decimals=3))
print("tanh   :", torch.tanh(x).round(decimals=3))
print("gelu   :", F.gelu(x).round(decimals=3))

logits = torch.tensor([2.0, 1.0, 0.1])
probs = F.softmax(logits, dim=-1)
print("softmax:", probs.round(decimals=3), "sum =", probs.sum().item())

# Sigmoid gradient vanishes for large |x|
for val in [0.0, 2.0, 6.0, 12.0]:
    t = torch.tensor(val, requires_grad=True)
    torch.sigmoid(t).backward()
    print(f"sigmoid grad at x={val:5.1f}: {t.grad.item():.6f}")

# Try it: compute the same gradients for ReLU at x=2 and x=12. Do they shrink?
<!-- QUIZ -->
[
  {"q": "Which activation outputs values that always sum to 1 across classes?", "options": ["ReLU", "Sigmoid", "Softmax", "Tanh"], "answer": 2, "explain": "Softmax converts logits into a probability distribution."},
  {"q": "Why can sigmoid cause vanishing gradients in deep networks?", "options": ["It is not differentiable", "It flattens for large |x|, giving near-zero gradients", "It outputs negative numbers", "It is too fast"], "answer": 1, "explain": "On the flat tails the slope is almost 0, and multiplied across layers the gradient disappears."},
  {"q": "What is a common default activation for hidden layers?", "options": ["Softmax", "ReLU", "Sigmoid", "None"], "answer": 1, "explain": "ReLU is cheap and works well in most hidden layers."}
]
