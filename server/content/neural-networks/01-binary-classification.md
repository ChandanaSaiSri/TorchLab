---
title: Binary Classification
xp: 35
---
## Predicting one of two classes

In binary classification each example belongs to class 0 or class 1 (spam or not, tumour or not). The recipe:

1. The model ends in **one raw output (a logit)** per example.
2. The loss is `nn.BCEWithLogitsLoss()`, which applies a sigmoid internally and is numerically stable.
3. To get a prediction, apply `torch.sigmoid(logit)` for a probability, then threshold (usually at 0.5).
4. Accuracy is the fraction of examples where the predicted class equals the label.

Targets must be floats with the same shape as the logits: `y.float().unsqueeze(1)` for logits of shape `(N, 1)`.

## Why you need hidden layers

Some data cannot be separated with a straight line. Imagine one class forming a ring around the other. A linear model draws a single line and scores near 50%. An MLP with a ReLU hidden layer can bend its boundary around the ring.

You will see exactly this in the starter code: the same data, a linear model, then an MLP.

## Training habits to keep

- Train for a fixed number of epochs and print loss and accuracy every so often.
- Wrap evaluation in `torch.no_grad()`.
- Set seeds so you can compare changes fairly.

<!-- STARTER -->
import math
import torch
from torch import nn

torch.manual_seed(0)

# Two concentric rings: inner = class 0, outer = class 1
n = 400
angle = torch.rand(n) * 2 * math.pi
radius = torch.cat([torch.full((n // 2,), 1.0), torch.full((n // 2,), 2.5)]) + 0.15 * torch.randn(n)
X = torch.stack([radius * torch.cos(angle), radius * torch.sin(angle)], dim=1)
y = torch.cat([torch.zeros(n // 2), torch.ones(n // 2)]).unsqueeze(1)

def train(model, epochs=300, lr=0.05):
    loss_fn = nn.BCEWithLogitsLoss()
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    for _ in range(epochs):
        loss = loss_fn(model(X), y)
        opt.zero_grad(); loss.backward(); opt.step()
    with torch.no_grad():
        pred = (torch.sigmoid(model(X)) > 0.5).float()
        acc = (pred == y).float().mean().item()
    return loss.item(), acc

linear = nn.Linear(2, 1)
mlp = nn.Sequential(nn.Linear(2, 16), nn.ReLU(), nn.Linear(16, 16), nn.ReLU(), nn.Linear(16, 1))

l_loss, l_acc = train(linear)
m_loss, m_acc = train(mlp)
print(f"linear model: loss={l_loss:.3f} accuracy={l_acc:.1%}")
print(f"MLP         : loss={m_loss:.3f} accuracy={m_acc:.1%}")

# Try it: shrink the MLP to nn.Linear(2, 2), ReLU, nn.Linear(2, 1). How low can the width go?
<!-- QUIZ -->
[
  {"q": "What should a binary classifier's final layer output with BCEWithLogitsLoss?", "options": ["A probability between 0 and 1", "One raw logit per example", "A class index", "Two softmax values"], "answer": 1, "explain": "BCEWithLogitsLoss applies the sigmoid itself, so give it raw logits."},
  {"q": "A linear model scores about 50% on ring-shaped classes. Why?", "options": ["Too few epochs", "A straight line cannot separate them", "The loss is wrong", "The learning rate is too small"], "answer": 1, "explain": "A single linear boundary cannot enclose a ring; hidden layers with activations can."},
  {"q": "To turn a logit into a predicted class you typically...", "options": ["Round the logit", "Apply sigmoid and threshold at 0.5", "Apply softmax over one value", "Take the square root"], "answer": 1, "explain": "sigmoid gives a probability; above 0.5 means class 1."}
]
