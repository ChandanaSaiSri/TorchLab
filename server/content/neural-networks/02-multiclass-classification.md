---
title: Multi-class Classification
xp: 35
---
## More than two classes

For `K` classes the model outputs **K logits** per example, one score per class. The pieces change slightly from the binary case:

| Piece | Binary | Multi-class |
|-------|--------|-------------|
| Output size | 1 | K |
| Loss | `BCEWithLogitsLoss` | `CrossEntropyLoss` |
| Targets | floats, shape `(N, 1)` | integer class ids, shape `(N,)` |
| Prediction | sigmoid then threshold | `argmax` over classes |

`CrossEntropyLoss` combines log-softmax and negative log-likelihood. Do not add a softmax layer before it.

## Reading the output

- `logits.argmax(dim=1)` gives the predicted class for each row.
- `F.softmax(logits, dim=1)` gives probabilities, which you can read as confidence. A model that is 40% / 35% / 25% is much less sure than one that outputs 98% / 1% / 1%.

## Class ids must start at 0

For K classes the labels must be `0 ... K-1` as `torch.long` (int64). Labels of `1, 2, 3` for three classes cause an index error.

## Mini-batches

You will usually combine this with a `DataLoader`, but the logic is identical. The starter uses full-batch training on a small synthetic dataset for clarity.

<!-- STARTER -->
import torch
from torch import nn
import torch.nn.functional as F

torch.manual_seed(1)

# Three Gaussian blobs
centres = torch.tensor([[0.0, 3.0], [-3.0, -2.0], [3.0, -2.0]])
per_class = 100
X = torch.cat([c + torch.randn(per_class, 2) for c in centres])
y = torch.arange(3).repeat_interleave(per_class)          # int64 class ids

perm = torch.randperm(len(X))
X, y = X[perm], y[perm]

model = nn.Sequential(nn.Linear(2, 16), nn.ReLU(), nn.Linear(16, 3))
loss_fn = nn.CrossEntropyLoss()
opt = torch.optim.Adam(model.parameters(), lr=0.05)

for epoch in range(101):
    logits = model(X)
    loss = loss_fn(logits, y)
    opt.zero_grad(); loss.backward(); opt.step()
    if epoch % 25 == 0:
        acc = (logits.argmax(dim=1) == y).float().mean().item()
        print(f"epoch {epoch:3d} loss={loss.item():.3f} acc={acc:.1%}")

with torch.no_grad():
    sample = torch.tensor([[0.0, 2.5], [0.0, 0.0]])
    probs = F.softmax(model(sample), dim=1)
print("probabilities for a point near class 0 and one in the middle:\n", probs.round(decimals=3))

# Try it: move the blobs closer together (e.g. multiply centres by 0.4). What happens to accuracy and confidence?
<!-- QUIZ -->
[
  {"q": "For a 5-class problem, how many outputs does the final layer need?", "options": ["1", "2", "5", "10"], "answer": 2, "explain": "One logit per class."},
  {"q": "What dtype and shape should targets have for nn.CrossEntropyLoss with a batch of N?", "options": ["float, (N, K)", "int64, (N,)", "float, (N,)", "int64, (N, K)"], "answer": 1, "explain": "Class indices as torch.long with one entry per example."},
  {"q": "How do you get predicted classes from logits of shape (N, K)?", "options": ["logits.max()", "logits.argmax(dim=1)", "logits.sum(dim=1)", "logits.softmax()"], "answer": 1, "explain": "argmax over the class dimension picks the highest-scoring class."}
]
