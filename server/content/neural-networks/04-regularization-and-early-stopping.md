---
title: Regularization and Early Stopping
xp: 35
---
## Making overfitting harder

**Regularisation** is any technique that discourages a model from fitting noise.

| Technique | How it works | In PyTorch |
|-----------|--------------|------------|
| **Weight decay (L2)** | Penalises large weights, pushing the model toward simpler functions | `optim.AdamW(params, weight_decay=1e-2)` |
| **Dropout** | Randomly zeroes a fraction of activations during training so no neuron can be relied on | `nn.Dropout(p=0.3)` |
| **Early stopping** | Stop when validation loss stops improving and keep the best weights | a few lines of code |
| **Data augmentation** | Create varied copies of training data (flips, crops, noise) | transforms |
| **Smaller model** | Fewer parameters, less capacity to memorise | design choice |

## Dropout details

Dropout is only active in `model.train()`. At evaluation (`model.eval()`) all neurons are used, and PyTorch scales values automatically so the expected activation stays consistent. Forgetting `eval()` makes your validation numbers noisy and pessimistic.

## Early stopping recipe

1. After each epoch, compute validation loss.
2. If it is the best so far, save a copy of the weights and reset a counter.
3. Otherwise increase the counter; if it reaches `patience`, stop.
4. Load the saved best weights at the end.

Patience gives noisy curves a chance to recover. Values like 10-20 epochs are common.

<!-- STARTER -->
import copy
import torch
from torch import nn

torch.manual_seed(0)
X = torch.rand(80, 1) * 6 - 3
y = torch.sin(X) + 0.3 * torch.randn_like(X)
Xtr, ytr, Xva, yva = X[:50], y[:50], X[50:], y[50:]
loss_fn = nn.MSELoss()

def run(dropout=0.0, weight_decay=0.0, patience=None, epochs=500):
    torch.manual_seed(1)
    model = nn.Sequential(
        nn.Linear(1, 128), nn.ReLU(), nn.Dropout(dropout),
        nn.Linear(128, 128), nn.ReLU(), nn.Dropout(dropout),
        nn.Linear(128, 1),
    )
    opt = torch.optim.AdamW(model.parameters(), lr=0.01, weight_decay=weight_decay)
    best, best_state, wait = float("inf"), None, 0
    for epoch in range(epochs):
        model.train()
        loss = loss_fn(model(Xtr), ytr)
        opt.zero_grad(); loss.backward(); opt.step()
        model.eval()
        with torch.no_grad():
            val = loss_fn(model(Xva), yva).item()
        if val < best:
            best, best_state, wait = val, copy.deepcopy(model.state_dict()), 0
        else:
            wait += 1
            if patience and wait >= patience:
                break
    if patience:                       # early stopping: keep the best weights
        model.load_state_dict(best_state)
        final = best
    else:                              # otherwise you simply end up with the last epoch's weights
        final = val
    return final, epoch + 1

for name, kwargs in [
    ("no regularisation   ", {}),
    ("dropout 0.2         ", {"dropout": 0.2}),
    ("weight decay 0.1    ", {"weight_decay": 0.1}),
    ("early stopping (20) ", {"patience": 20}),
]:
    final, ran = run(**kwargs)
    print(f"{name} final val loss={final:.4f}  epochs run={ran}")

# Try it: combine dropout=0.2 with patience=20 and weight_decay=0.1.
<!-- QUIZ -->
[
  {"q": "When is nn.Dropout active?", "options": ["Always", "Only in train mode", "Only in eval mode", "Only on the GPU"], "answer": 1, "explain": "Dropout is applied during model.train() and switched off by model.eval()."},
  {"q": "What does early stopping with patience=10 do?", "options": ["Stops after 10 epochs total", "Stops if validation loss has not improved for 10 epochs", "Waits 10 seconds", "Lowers the learning rate 10x"], "answer": 1, "explain": "Training ends when there has been no new best validation loss for 10 consecutive epochs."},
  {"q": "Weight decay regularises a model by...", "options": ["Removing layers", "Penalising large weights", "Adding data", "Skipping batches"], "answer": 1, "explain": "It shrinks weights toward zero, favouring simpler functions."}
]
