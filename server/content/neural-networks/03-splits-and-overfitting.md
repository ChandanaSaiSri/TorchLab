---
title: Train/Validation/Test Splits and Overfitting
xp: 35
---
## The goal is generalisation

A model that memorises its training data is useless; what matters is performance on **data it has never seen**. So we split the data:

| Split | Typical share | Purpose |
|-------|---------------|---------|
| **Train** | 60-80% | Update the weights |
| **Validation** | 10-20% | Tune choices (architecture, learning rate, when to stop) |
| **Test** | 10-20% | One final, honest estimate. Touch it once |

If you tune on the test set you leak information into your choices and the final score becomes optimistic.

## Overfitting

**Overfitting** happens when a model fits noise and quirks of the training set. The tell-tale picture: training loss keeps falling while validation loss bottoms out and then rises. **Underfitting** is the opposite: both are high because the model is too simple or undertrained.

## What causes it

- A model with many parameters relative to the amount of data.
- Training for too long.
- Noisy or tiny datasets.

## What to do about it

More data, a smaller model, regularisation (next lesson), data augmentation and early stopping. The first step is always to *measure* it by tracking train and validation loss every epoch.

## Splitting in code

Shuffle indices with `torch.randperm`, then slice. Fix the seed so the split is reproducible.

<!-- STARTER -->
import torch
from torch import nn

torch.manual_seed(0)

# A small, noisy dataset: y = sin(x) + noise. Only 40 points.
X = torch.rand(40, 1) * 6 - 3
y = torch.sin(X) + 0.3 * torch.randn_like(X)

perm = torch.randperm(len(X))
train_idx, val_idx = perm[:28], perm[28:]
Xtr, ytr, Xva, yva = X[train_idx], y[train_idx], X[val_idx], y[val_idx]
print("train:", len(Xtr), "val:", len(Xva))

# A deliberately oversized model
model = nn.Sequential(nn.Linear(1, 128), nn.ReLU(), nn.Linear(128, 128), nn.ReLU(), nn.Linear(128, 1))
opt = torch.optim.Adam(model.parameters(), lr=0.01)
loss_fn = nn.MSELoss()

best_val, best_epoch = float("inf"), 0
for epoch in range(1, 601):
    model.train()
    loss = loss_fn(model(Xtr), ytr)
    opt.zero_grad(); loss.backward(); opt.step()

    model.eval()
    with torch.no_grad():
        val = loss_fn(model(Xva), yva).item()
    if val < best_val:
        best_val, best_epoch = val, epoch
    if epoch in (10, 50, 100, 200, 400, 600):
        print(f"epoch {epoch:3d}  train={loss.item():.4f}  val={val:.4f}")

print(f"best validation loss {best_val:.4f} at epoch {best_epoch}")
print("If train keeps falling while val rises after that epoch, the model is overfitting.")

# Try it: shrink the hidden width from 128 to 8. Does the train/val gap change?
<!-- QUIZ -->
[
  {"q": "Training loss keeps dropping but validation loss starts rising. This is...", "options": ["Underfitting", "Overfitting", "A bug in the optimizer", "Normal and fine"], "answer": 1, "explain": "The model is memorising training data and generalising worse."},
  {"q": "What is the validation set for?", "options": ["Updating weights", "Making choices like when to stop or which model to use", "The final reported score, used once", "Augmenting data"], "answer": 1, "explain": "Validation guides decisions; the test set is reserved for one final unbiased measurement."},
  {"q": "Why shouldn't you tune hyperparameters on the test set?", "options": ["It is slower", "It leaks information so the final score is optimistic", "Test data is too small", "PyTorch forbids it"], "answer": 1, "explain": "Choices made by looking at the test score make it no longer an independent estimate."}
]
