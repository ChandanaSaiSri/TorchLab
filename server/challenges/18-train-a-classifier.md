---
title: Train a Spiral Classifier
difficulty: hard
category: Optimization & Training
---
Three intertwined spirals cannot be separated by a straight line, so you need a hidden layer and a real training loop.

Write `train_classifier(X, y)`:

- `X`: float `(N, 2)` points, `y`: long `(N,)` with classes `0, 1, 2`
- build a model, train it, and **return the trained model** (an `nn.Module` that maps `(N, 2)` to `(N, 3)` scores)

Your model is checked on its training data and on a **new spiral drawn with a different seed**. It must reach 90% / 85% accuracy and finish quickly (the whole run has a 20-second budget).
<!-- STARTER -->
import torch
from torch import nn

def train_classifier(X, y):
    # TODO: build a model with at least one hidden layer, train it, return it
    pass
<!-- SOLUTION -->
import torch
from torch import nn

def train_classifier(X, y):
    torch.manual_seed(0)
    model = nn.Sequential(nn.Linear(2, 64), nn.ReLU(), nn.Linear(64, 64), nn.ReLU(), nn.Linear(64, 3))
    opt = torch.optim.Adam(model.parameters(), lr=0.02)
    for _ in range(500):
        loss = nn.functional.cross_entropy(model(X), y)
        opt.zero_grad()
        loss.backward()
        opt.step()
    return model
<!-- HINTS -->
Use an MLP such as `Linear(2, 64) -> ReLU -> Linear(64, 64) -> ReLU -> Linear(64, 3)` with `nn.CrossEntropyLoss` (the raw scores go straight into it).
===
Adam with `lr` around 0.01-0.03 works well here. Train on the whole dataset each step for a few hundred steps.
===
Zero the gradients every step. If accuracy stalls near 33-60%, the model is probably too small or has not trained long enough.
<!-- TESTS -->
def _spiral(n, seed, noise=0.2):
    g = torch.Generator().manual_seed(seed)
    X, y = [], []
    for c in range(3):
        r = torch.linspace(0.1, 1, n)
        t = torch.linspace(c * 4, (c + 1) * 4, n) + torch.randn(n, generator=g) * noise
        X.append(torch.stack([r * torch.sin(t), r * torch.cos(t)], 1))
        y.append(torch.full((n,), c))
    return torch.cat(X), torch.cat(y)

def _acc(model, X, y):
    model.eval()
    with torch.no_grad():
        return (model(X).argmax(1) == y).float().mean().item()

def test_returns_a_model():
    X, y = _spiral(100, 0)
    m = train_classifier(X, y)
    assert isinstance(m, nn.Module), "return the trained nn.Module"
    assert m(X).shape == (300, 3), f"output shape should be (300, 3), got {tuple(m(X).shape)}"

def test_training_accuracy():
    X, y = _spiral(100, 0)
    acc = _acc(train_classifier(X, y), X, y)
    assert acc >= 0.90, f"training accuracy {acc:.1%}; need 90%"

def hidden_generalises():
    X, y = _spiral(100, 0)
    m = train_classifier(X, y)
    Xn, yn = _spiral(100, 1)
    assert _acc(m, Xn, yn) >= 0.85

def hidden_input_not_modified():
    X, y = _spiral(100, 0)
    X0 = X.clone()
    train_classifier(X, y)
    assert torch.equal(X, X0)
