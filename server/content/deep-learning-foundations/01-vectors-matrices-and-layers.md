---
title: Vectors, Matrices and Layers
xp: 25
---
## The linear algebra you actually need

Neural networks are mostly one operation repeated: multiply by a matrix, add a vector.

**Dot product.** For two vectors `a` and `b` of equal length, `a . b = a1*b1 + a2*b2 + ...`. It measures how aligned they are and is the heart of a single neuron: *weights dot inputs*.

**Matrix-vector product.** A matrix `W` of shape `(out, in)` times a vector `x` of shape `(in,)` gives a vector of shape `(out,)`: each output is the dot product of one row of `W` with `x`.

**A layer** computes `y = W x + b`. `W` holds the **weights** and `b` the **biases**; together they are the layer's learnable parameters.

## Batches

Real data comes in batches: `X` has shape `(batch, in)`. PyTorch stores `nn.Linear` weights as `(out, in)` and computes `X @ W.T + b`, giving `(batch, out)`. Each row of `X` is processed independently.

## Shape bookkeeping

`(batch, in) @ (in, out) -> (batch, out)`. If the inner sizes do not match, you have a shape bug. Most of PyTorch debugging is checking these numbers.

<!-- STARTER -->
import torch
from torch import nn

a = torch.tensor([1.0, 2.0, 3.0])
b = torch.tensor([4.0, 5.0, 6.0])
print("dot:", torch.dot(a, b).item(), "(1*4 + 2*5 + 3*6 = 32)")

# One layer by hand: 3 inputs -> 2 outputs
W = torch.tensor([[1.0, 0.0, -1.0],
                  [0.5, 0.5, 0.5]])      # shape (2, 3)
bias = torch.tensor([0.0, 1.0])
x = torch.tensor([2.0, 4.0, 6.0])
print("W @ x + b =", W @ x + bias)

# nn.Linear does the same thing, for a whole batch
layer = nn.Linear(3, 2)
with torch.no_grad():
    layer.weight.copy_(W)
    layer.bias.copy_(bias)

X = torch.tensor([[2.0, 4.0, 6.0],
                  [1.0, 1.0, 1.0]])      # batch of 2
print("layer(X):\n", layer(X))
print("manual  :\n", X @ W.T + bias)
print("weight shape", tuple(layer.weight.shape), "bias shape", tuple(layer.bias.shape))

# Try it: what happens if you pass a batch with 4 features instead of 3 to the layer?
<!-- QUIZ -->
[
  {"q": "A layer has weight shape (5, 3). What input feature count does it expect?", "options": ["5", "3", "8", "15"], "answer": 1, "explain": "Weights are (out, in), so this layer maps 3 inputs to 5 outputs."},
  {"q": "X has shape (32, 10) and a Linear layer maps 10 -> 4. What is the output shape?", "options": ["(10, 4)", "(32, 4)", "(32, 10)", "(4,)"], "answer": 1, "explain": "The batch dimension stays 32; features go from 10 to 4."},
  {"q": "What is the dot product of [1, 2, 3] and [4, 5, 6]?", "options": ["15", "21", "32", "6"], "answer": 2, "explain": "1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32."}
]
