---
title: Datasets and DataLoaders
xp: 30
---
## Feeding data to a model

Real datasets are too large to push through a model in one go, and training on one example at a time is noisy and slow. We train on **mini-batches**: small groups of examples (commonly 32 to 256). PyTorch splits this into two ideas:

- **Dataset**: knows how many examples exist and how to fetch example `i`.
- **DataLoader**: wraps a dataset and serves batches, optionally shuffled.

## A custom Dataset needs two methods

```python
class MyData(Dataset):
    def __len__(self):            # how many examples
        ...
    def __getitem__(self, i):     # return (input, label) for example i
        ...
```

For tensors already in memory, `TensorDataset(X, y)` does this for you.

## DataLoader options

- `batch_size`: examples per batch. The last batch may be smaller unless you set `drop_last=True`.
- `shuffle=True` for training so each epoch sees a different order; leave it `False` for validation and test.
- `num_workers`: parallel loading processes (use 0 in this platform).

## The epoch loop with batches

```python
for epoch in range(epochs):
    for xb, yb in loader:
        pred = model(xb)
        loss = loss_fn(pred, yb)
        optimizer.zero_grad(); loss.backward(); optimizer.step()
```

One pass through the whole loader is one **epoch**. With 1,000 examples and batch size 100, an epoch is 10 steps.

<!-- STARTER -->
import torch
from torch import nn
from torch.utils.data import Dataset, DataLoader, TensorDataset

torch.manual_seed(0)

class LineData(Dataset):
    """Noisy samples of y = 3x - 1."""
    def __init__(self, n=200):
        self.x = torch.rand(n, 1) * 4 - 2
        self.y = 3 * self.x - 1 + 0.1 * torch.randn(n, 1)

    def __len__(self):
        return len(self.x)

    def __getitem__(self, i):
        return self.x[i], self.y[i]

ds = LineData()
print("dataset size:", len(ds), "| first item shapes:", [tuple(t.shape) for t in ds[0]])

loader = DataLoader(ds, batch_size=32, shuffle=True)
print("batches per epoch:", len(loader))
xb, yb = next(iter(loader))
print("one batch:", tuple(xb.shape), tuple(yb.shape))

model = nn.Linear(1, 1)
loss_fn = nn.MSELoss()
opt = torch.optim.SGD(model.parameters(), lr=0.05)

for epoch in range(30):
    total = 0.0
    for xb, yb in loader:
        loss = loss_fn(model(xb), yb)
        opt.zero_grad(); loss.backward(); opt.step()
        total += loss.item() * len(xb)
    if epoch % 10 == 0:
        print(f"epoch {epoch:2d} avg loss {total / len(ds):.4f}")

print(f"learned w={model.weight.item():.2f} b={model.bias.item():.2f} (true 3, -1)")

# Try it: build the same loader with TensorDataset(ds.x, ds.y) and confirm it gives the same batch shapes.
<!-- QUIZ -->
[
  {"q": "Which two methods must a custom Dataset implement?", "options": ["__init__ and forward", "__len__ and __getitem__", "fit and predict", "load and save"], "answer": 1, "explain": "The DataLoader needs to know the size (__len__) and how to fetch item i (__getitem__)."},
  {"q": "1,000 examples with batch_size=100. How many optimizer steps are in one epoch?", "options": ["1", "10", "100", "1,000"], "answer": 1, "explain": "1000 / 100 = 10 batches, so 10 steps."},
  {"q": "Why shuffle the training loader but not the test loader?", "options": ["Shuffling the test set is illegal", "Shuffling training data decorrelates batches; evaluation does not need it", "It makes test faster", "Test data has no order"], "answer": 1, "explain": "A fresh order each epoch helps training; evaluation results do not depend on order."}
]
