---
title: Loss Functions
xp: 25
---
## What a loss does

A loss function compresses "how wrong is the model?" into one number that training tries to minimise. It must be differentiable so gradients can flow.

## Choosing by task

| Task | Loss | PyTorch | Model output |
|------|------|---------|--------------|
| Regression | Mean squared error | `nn.MSELoss()` | any real number |
| Regression (outlier-robust) | Mean absolute error | `nn.L1Loss()` | any real number |
| Binary classification | Binary cross-entropy | `nn.BCEWithLogitsLoss()` | **one logit** per example |
| Multi-class classification | Cross-entropy | `nn.CrossEntropyLoss()` | **one logit per class** |

## Cross-entropy in one idea

Cross-entropy punishes confident wrong answers heavily. If the true class is 2 and the model gives it probability `p`, the loss is `-log(p)`: a probability of 0.9 costs about 0.105, but 0.01 costs about 4.6.

## Rules that prevent common bugs

- `CrossEntropyLoss` expects **raw logits** of shape `(batch, classes)` and **integer class indices** of shape `(batch,)` (dtype `int64`). Do not apply softmax first, and do not one-hot encode the target.
- `BCEWithLogitsLoss` expects raw logits and float targets of the *same shape* (0.0 or 1.0).
- `MSELoss` needs prediction and target of the same shape; a hidden `(N, 1)` vs `(N,)` mismatch silently broadcasts into a wrong answer.

<!-- STARTER -->
import torch
from torch import nn
import torch.nn.functional as F

# Regression: MSE by hand vs nn.MSELoss
pred = torch.tensor([2.5, 0.0, 2.0])
true = torch.tensor([3.0, -0.5, 2.0])
print("MSE manual :", ((pred - true) ** 2).mean().item())
print("MSE torch  :", nn.MSELoss()(pred, true).item())

# Multi-class: cross-entropy = -log(softmax probability of the true class)
logits = torch.tensor([[2.0, 1.0, 0.1],
                       [0.2, 3.0, 0.3]])
target = torch.tensor([0, 1])                       # class indices
probs = F.softmax(logits, dim=1)
manual = -torch.log(probs[torch.arange(2), target]).mean()
print("CE manual  :", round(manual.item(), 4))
print("CE torch   :", round(nn.CrossEntropyLoss()(logits, target).item(), 4))

# Confident-and-wrong costs more
for p in [0.9, 0.5, 0.1, 0.01]:
    print(f"true-class prob {p:4.2f} -> loss {-torch.log(torch.tensor(p)).item():.3f}")

# Binary: BCEWithLogits takes logits and float targets
logit = torch.tensor([1.5, -2.0])
label = torch.tensor([1.0, 0.0])
print("BCE        :", round(nn.BCEWithLogitsLoss()(logit, label).item(), 4))

# Try it: a (3,) vs (3, 1) shape mismatch in MSELoss. What does the result look like?
<!-- QUIZ -->
[
  {"q": "What input does nn.CrossEntropyLoss expect?", "options": ["Probabilities and one-hot targets", "Raw logits and integer class indices", "Softmax outputs and floats", "Sigmoid outputs and indices"], "answer": 1, "explain": "It applies log-softmax internally, so feed raw logits with int64 class indices."},
  {"q": "If the model gives the true class probability 0.01, the cross-entropy loss is about...", "options": ["0.01", "0.1", "4.6", "100"], "answer": 2, "explain": "-ln(0.01) is about 4.6. Confident mistakes are penalised heavily."},
  {"q": "Which loss suits predicting a house price?", "options": ["CrossEntropyLoss", "BCEWithLogitsLoss", "MSELoss", "None of these"], "answer": 2, "explain": "Price is a continuous value, so regression losses like MSE fit."}
]
