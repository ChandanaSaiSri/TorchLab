---
title: Neurons, Layers and Parameters
xp: 25
---
## One artificial neuron

A neuron takes several inputs, multiplies each by a weight, adds them up with a bias, and passes the result through an **activation function**:

`output = activation(w1*x1 + w2*x2 + ... + b)`

It is loosely inspired by biology, but it is just arithmetic with learnable numbers.

## From neurons to networks

- A **layer** is many neurons side by side, sharing the same inputs.
- A **network** stacks layers: the outputs of one become the inputs of the next.
- **Input layer**: your data. **Hidden layers**: the learned intermediate features. **Output layer**: the prediction.

A network with at least one hidden layer is often called a **multi-layer perceptron (MLP)**.

## Counting parameters

A `Linear(in, out)` layer has `in*out` weights plus `out` biases. For `Linear(10, 32)`: `10*32 + 32 = 352`. Parameter count is a rough measure of a model's size and memory cost.

## Why non-linearity is essential

Two linear layers in a row, `W2 (W1 x)`, equal a single linear layer with weight `W2 W1`. Without an activation function between them, depth adds nothing: the whole network is still a straight-line (linear) function. Activations like ReLU bend the function so stacked layers can represent curves and complex boundaries.

<!-- STARTER -->
import torch
from torch import nn

torch.manual_seed(0)

# One neuron by hand
x = torch.tensor([1.0, -2.0, 0.5])
w = torch.tensor([0.4, 0.3, -1.0])
b = 0.1
z = (w * x).sum() + b
print("pre-activation:", round(z.item(), 3), "| after ReLU:", torch.relu(z).item())

# Parameter counting
mlp = nn.Sequential(nn.Linear(10, 32), nn.ReLU(), nn.Linear(32, 3))
total = 0
for name, p in mlp.named_parameters():
    print(f"{name:10s} shape={tuple(p.shape)} count={p.numel()}")
    total += p.numel()
print("total parameters:", total, "(10*32+32 + 32*3+3 = 451)")

# Two linear layers with no activation collapse into ONE linear layer
l1, l2 = nn.Linear(4, 6, bias=False), nn.Linear(6, 2, bias=False)
x = torch.randn(5, 4)
two_layers = l2(l1(x))
one_layer = x @ (l2.weight @ l1.weight).T
print("collapse check (should be True):", torch.allclose(two_layers, one_layer, atol=1e-6))

# Try it: insert nn.ReLU() between l1 and l2 and see if the collapse check still holds.
<!-- QUIZ -->
[
  {"q": "How many parameters does nn.Linear(10, 32) have (with bias)?", "options": ["320", "342", "352", "42"], "answer": 2, "explain": "10*32 weights + 32 biases = 352."},
  {"q": "Why can't a stack of purely linear layers learn curved decision boundaries?", "options": ["They are too slow", "Composing linear functions gives another linear function", "They have no biases", "PyTorch forbids it"], "answer": 1, "explain": "W2(W1 x) = (W2 W1) x. Depth adds nothing without non-linear activations."},
  {"q": "What is a hidden layer?", "options": ["A layer whose weights are secret", "A layer between the input and output layers", "The final layer", "A layer with no parameters"], "answer": 1, "explain": "Hidden layers sit between input and output and learn intermediate features."}
]
