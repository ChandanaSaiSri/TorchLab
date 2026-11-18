---
title: Building and Training a CNN
xp: 40
---
## The standard recipe

A small image classifier is a **feature extractor** followed by a **classifier**:

```
Conv -> ReLU -> Pool   (repeat, increasing channels)
Flatten
Linear -> logits
```

The convolutional blocks turn pixels into increasingly abstract feature maps while shrinking height and width. `nn.Flatten()` turns the last feature maps into one vector per image, and a `Linear` layer produces one logit per class.

## Working out the Linear input size

For 8x8 input with two `Conv(k=3, padding=1)` + `MaxPool(2)` blocks: 8 -> 4 -> 2 pixels, and 16 channels, so the flattened size is `16 * 2 * 2 = 64`. When unsure, run a dummy tensor through the feature part and read `.shape`, or use `nn.LazyLinear`.

## Training is unchanged

Same loop as before: `CrossEntropyLoss`, an optimizer, `zero_grad` / `backward` / `step`, evaluation under `model.eval()` and `torch.no_grad()`. Only the model and the input shape changed.

## Our toy dataset

Real datasets such as MNIST need a download, which the sandbox does not allow, so the starter **generates** 8x8 images: a horizontal bar (class 0), a vertical bar (class 1) or a diagonal (class 2) at random positions, plus noise. The CNN has to learn orientation detectors, exactly what convolutions are good at.

<!-- STARTER -->
import torch
from torch import nn

torch.manual_seed(0)

def make_images(n_per_class):
    imgs, labels = [], []
    for cls in range(3):
        for _ in range(n_per_class):
            im = 0.15 * torch.randn(8, 8)
            pos = torch.randint(1, 7, (1,)).item()
            if cls == 0:
                im[pos, :] += 1.0                       # horizontal bar
            elif cls == 1:
                im[:, pos] += 1.0                       # vertical bar
            else:
                im += torch.eye(8) * 1.0                # diagonal
            imgs.append(im); labels.append(cls)
    X = torch.stack(imgs).unsqueeze(1)                  # (N, 1, 8, 8)
    return X, torch.tensor(labels)

X, y = make_images(120)
perm = torch.randperm(len(X))
X, y = X[perm], y[perm]
Xtr, ytr, Xte, yte = X[:270], y[:270], X[270:], y[270:]

model = nn.Sequential(
    nn.Conv2d(1, 8, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),     # 8x8 -> 4x4
    nn.Conv2d(8, 16, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),    # 4x4 -> 2x2
    nn.Flatten(),
    nn.Linear(16 * 2 * 2, 3),
)
print("params:", sum(p.numel() for p in model.parameters()))

loss_fn = nn.CrossEntropyLoss()
opt = torch.optim.Adam(model.parameters(), lr=0.01)
for epoch in range(61):
    model.train()
    loss = loss_fn(model(Xtr), ytr)
    opt.zero_grad(); loss.backward(); opt.step()
    if epoch % 20 == 0:
        model.eval()
        with torch.no_grad():
            acc = (model(Xte).argmax(1) == yte).float().mean().item()
        print(f"epoch {epoch:2d} train loss={loss.item():.3f} test acc={acc:.1%}")

# Try it: remove the second conv block (and fix the Linear input size). How does accuracy change?
<!-- QUIZ -->
[
  {"q": "After two blocks of Conv(padding=1) + MaxPool(2) on 8x8 input, what are height and width?", "options": ["8x8", "4x4", "2x2", "1x1"], "answer": 2, "explain": "Padding keeps size; each pool halves it: 8 -> 4 -> 2."},
  {"q": "What does nn.Flatten() do between the conv part and the Linear layer?", "options": ["Removes the batch dimension", "Turns each image's feature maps into a single vector", "Normalises the values", "Applies softmax"], "answer": 1, "explain": "Flatten keeps the batch dimension and merges channels, height and width into one."},
  {"q": "Which part of the training loop changes when you switch from an MLP to a CNN?", "options": ["The loss function must change", "Only the model and the shape of the input data", "You must stop using optimizers", "Backward is replaced"], "answer": 1, "explain": "The loop is identical; the model and the (batch, channels, H, W) input shape differ."}
]
