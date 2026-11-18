---
title: Transfer Learning
xp: 40
---
## Reuse what a model already knows

Training a good vision model from scratch needs lots of data and compute. **Transfer learning** starts from a model already trained on a large task and adapts it to yours. The early layers learn general features (edges, textures) that are useful almost everywhere; only the last layers are specific to the original labels.

## Two strategies

| Strategy | What you do | Use when |
|----------|-------------|----------|
| **Feature extraction** | Freeze the pretrained layers; replace and train only the final classifier | Very little data |
| **Fine-tuning** | Train everything (or the top layers), with a small learning rate | More data, or the new task differs more |

## Freezing in PyTorch

```python
for p in model.features.parameters():
    p.requires_grad = False          # no gradients, no updates
model.classifier = nn.Linear(16, new_classes)   # new trainable head
optimizer = torch.optim.Adam(
    [p for p in model.parameters() if p.requires_grad], lr=1e-3)
```

Check what is trainable with `sum(p.numel() for p in model.parameters() if p.requires_grad)`.

## In real projects

You would load pretrained weights, for example `torchvision.models.resnet18(weights=...)`, which downloads them from the internet. This sandbox has no network access, so the starter **pretrains its own small CNN on one task and transfers it to another**, showing the exact same mechanics.

Remember to put a frozen model's feature layers in `eval()` mode when they contain batch norm or dropout, and to use the same input preprocessing as during pretraining.

<!-- STARTER -->
import copy
import torch
from torch import nn

torch.manual_seed(0)

def bars(n, kinds, noise=0.15):
    """8x8 images; `kinds` maps class id -> drawing function."""
    X, y = [], []
    for cls, draw in enumerate(kinds):
        for _ in range(n):
            im = noise * torch.randn(8, 8)
            draw(im, torch.randint(1, 7, (1,)).item())
            X.append(im); y.append(cls)
    X = torch.stack(X).unsqueeze(1); y = torch.tensor(y)
    p = torch.randperm(len(X))
    return X[p], y[p]

def hbar(im, p): im[p, :] += 1.0
def vbar(im, p): im[:, p] += 1.0
def diag_down(im, p): im += torch.eye(8)
def diag_up(im, p): im += torch.eye(8).flip(1)

class Net(nn.Module):
    def __init__(self, n_classes):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 8, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(8, 16, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2), nn.Flatten())
        self.head = nn.Linear(64, n_classes)
    def forward(self, x):
        return self.head(self.features(x))

def fit(model, X, y, epochs=80, lr=0.01):
    params = [p for p in model.parameters() if p.requires_grad]
    opt = torch.optim.Adam(params, lr=lr)
    for _ in range(epochs):
        loss = nn.functional.cross_entropy(model(X), y)
        opt.zero_grad(); loss.backward(); opt.step()

def acc(model, X, y):
    model.eval()
    with torch.no_grad():
        return (model(X).argmax(1) == y).float().mean().item()

def trainable(model):
    return sum(p.numel() for p in model.parameters() if p.requires_grad)

# Task A: plenty of data (horizontal / vertical / diagonal-down)
XA, yA = bars(150, [hbar, vbar, diag_down])
pretrained = Net(3); fit(pretrained, XA, yA)
print("task A accuracy:", f"{acc(pretrained, XA, yA):.1%}")

# Task B: a *different* task with only 3 examples per class and noisier images (diagonal-down / diagonal-up / horizontal)
XB, yB = bars(3, [diag_down, diag_up, hbar], noise=0.5)
XBt, yBt = bars(100, [diag_down, diag_up, hbar], noise=0.5)

scratch = Net(3)
fit(scratch, XB, yB)

frozen = copy.deepcopy(pretrained)
for p in frozen.features.parameters():
    p.requires_grad = False
frozen.head = nn.Linear(64, 3)                  # new head
fit(frozen, XB, yB)

finetuned = copy.deepcopy(pretrained)
finetuned.head = nn.Linear(64, 3)
fit(finetuned, XB, yB, lr=0.002)                # smaller lr for fine-tuning

print(f"from scratch : trainable={trainable(scratch):4d} test acc={acc(scratch, XBt, yBt):.1%}")
print(f"frozen+head  : trainable={trainable(frozen):4d} test acc={acc(frozen, XBt, yBt):.1%}")
print(f"fine-tuned   : trainable={trainable(finetuned):4d} test acc={acc(finetuned, XBt, yBt):.1%}")

# Try it: use 1 example per class for task B. Which strategy degrades most?
<!-- QUIZ -->
[
  {"q": "What does 'freezing' layers mean?", "options": ["Deleting them", "Setting requires_grad=False so they are not updated", "Saving them to disk", "Converting to float16"], "answer": 1, "explain": "Frozen parameters get no gradients and keep their pretrained values."},
  {"q": "You have very little data for a new task. Which strategy is usually safest?", "options": ["Train from scratch", "Freeze pretrained layers and train only a new head", "Use a huge learning rate", "Remove all layers"], "answer": 1, "explain": "Feature extraction trains few parameters, which limits overfitting on small datasets."},
  {"q": "Why is a smaller learning rate typical when fine-tuning?", "options": ["To make it slower on purpose", "To avoid wrecking the pretrained weights with big updates", "Because the loss is different", "Optimizers require it"], "answer": 1, "explain": "The pretrained weights are already good; small steps adapt them without destroying what they learned."}
]
