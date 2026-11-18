---
title: Building Models with nn.Module
xp: 30
---
## The standard way to define a model

Every PyTorch model is a subclass of `nn.Module`. You do two things:

1. In `__init__`, call `super().__init__()` and create the layers as attributes.
2. In `forward(self, x)`, describe how data flows through them.

```python
class MLP(nn.Module):
    def __init__(self, n_in, n_hidden, n_out):
        super().__init__()
        self.fc1 = nn.Linear(n_in, n_hidden)
        self.fc2 = nn.Linear(n_hidden, n_out)

    def forward(self, x):
        return self.fc2(torch.relu(self.fc1(x)))
```

You never call `forward` directly. Write `model(x)`; PyTorch's `__call__` runs `forward` plus bookkeeping such as hooks.

## Why assign layers as attributes?

`nn.Module` automatically registers layers (and their parameters) assigned in `__init__`. That is how `model.parameters()` finds every weight to hand to the optimizer, and how `model.to(device)` and `model.state_dict()` work. A plain Python list of layers would *not* be registered; use `nn.ModuleList` for that.

## Shortcut: nn.Sequential

When data simply flows layer to layer, `nn.Sequential(nn.Linear(...), nn.ReLU(), nn.Linear(...))` saves writing a class. Use a custom class when you need branching, skip connections or several inputs.

## train() and eval()

Some layers behave differently in training and evaluation (dropout, batch norm). `model.train()` and `model.eval()` switch the mode; remember to call `eval()` (plus `torch.no_grad()`) when predicting.

<!-- STARTER -->
import torch
from torch import nn

class MLP(nn.Module):
    def __init__(self, n_in, n_hidden, n_out):
        super().__init__()
        self.fc1 = nn.Linear(n_in, n_hidden)
        self.fc2 = nn.Linear(n_hidden, n_out)

    def forward(self, x):
        return self.fc2(torch.relu(self.fc1(x)))

torch.manual_seed(0)
model = MLP(4, 8, 3)
print(model)

x = torch.randn(5, 4)                  # batch of 5
out = model(x)                         # calls forward()
print("output shape:", tuple(out.shape))

for name, p in model.named_parameters():
    print(f"{name:12s} {tuple(p.shape)}")
print("total params:", sum(p.numel() for p in model.parameters()))

# Same architecture as a Sequential
seq = nn.Sequential(nn.Linear(4, 8), nn.ReLU(), nn.Linear(8, 3))
print("sequential output shape:", tuple(seq(x).shape))

# Dropout behaves differently in train vs eval
drop = nn.Dropout(0.5)
ones = torch.ones(8)
drop.train(); print("train:", drop(ones))
drop.eval();  print("eval :", drop(ones))

# Try it: add a second hidden layer fc3 to MLP and check the new parameter count.
<!-- QUIZ -->
[
  {"q": "Why do you call model(x) instead of model.forward(x)?", "options": ["forward does not exist", "__call__ runs forward plus PyTorch bookkeeping like hooks", "It is faster to type", "forward is private"], "answer": 1, "explain": "Calling the module goes through __call__, which handles hooks and mode behaviour around forward."},
  {"q": "What does assigning self.fc1 = nn.Linear(...) in __init__ achieve?", "options": ["Nothing special", "The layer's parameters are registered and show up in model.parameters()", "It trains the layer immediately", "It freezes the layer"], "answer": 1, "explain": "nn.Module registers submodules assigned as attributes, so the optimizer and state_dict can find them."},
  {"q": "Which call puts dropout and batch-norm layers into evaluation behaviour?", "options": ["model.train()", "model.eval()", "model.zero_grad()", "model.backward()"], "answer": 1, "explain": "eval() disables dropout and makes batch norm use stored statistics."}
]
