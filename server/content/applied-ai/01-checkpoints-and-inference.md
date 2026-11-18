---
title: Saving, Loading and Inference
xp: 35
---
## What to save

A trained model is just its **parameters**. The recommended way to persist it is the `state_dict`, a dictionary mapping layer names to tensors:

```python
torch.save(model.state_dict(), "model.pt")

model = MyNet()                               # rebuild the architecture first
model.load_state_dict(torch.load("model.pt"))
model.eval()
```

Saving the whole model object with pickle ties the file to your exact code layout, so prefer `state_dict`.

## Checkpoints for resuming training

To resume, also save the optimizer state and the epoch:

```python
torch.save({"epoch": e, "model": model.state_dict(),
            "optim": opt.state_dict(), "best_val": best}, "ckpt.pt")
```

Keep the best checkpoint by validation score, not just the last one.

## Inference checklist

1. `model.eval()`: turns off dropout and uses running batch-norm statistics.
2. `torch.inference_mode()` (or `no_grad`): no graph is built, saving memory and time.
3. Apply the **same preprocessing** as training (normalisation, shapes).
4. Convert logits to probabilities with `softmax` and pick `argmax`.

Forgetting step 1 is the most common cause of "my loaded model gives different results".

<!-- STARTER -->
import io
import torch
from torch import nn

torch.manual_seed(0)

class Net(nn.Module):
    def __init__(self):
        super().__init__()
        self.body = nn.Sequential(nn.Linear(4, 16), nn.ReLU(), nn.Dropout(0.5), nn.Linear(16, 3))
    def forward(self, x):
        return self.body(x)

model = Net()
opt = torch.optim.Adam(model.parameters(), lr=0.01)

# --- save a checkpoint into memory (a real project would use a file path) ---
buffer = io.BytesIO()
torch.save({"epoch": 7, "model": model.state_dict(), "optim": opt.state_dict()}, buffer)
print("checkpoint size:", buffer.getbuffer().nbytes, "bytes")
print("state_dict keys:", list(model.state_dict().keys()))

# --- load into a *fresh* model ---
buffer.seek(0)
ckpt = torch.load(buffer)
restored = Net()
restored.load_state_dict(ckpt["model"])
print("resume from epoch:", ckpt["epoch"])

x = torch.randn(5, 4)
model.eval(); restored.eval()
with torch.inference_mode():
    same = torch.allclose(model(x), restored(x))
print("restored model gives identical outputs:", same)

# --- why eval() matters: dropout makes train-mode outputs random ---
model.train()
a, b = model(x), model(x)
print("train mode, same input twice identical:", torch.allclose(a, b))
model.eval()
with torch.inference_mode():
    a, b = model(x), model(x)
print("eval mode, same input twice identical:", torch.allclose(a, b))

# --- prediction with probabilities ---
with torch.inference_mode():
    probs = torch.softmax(model(x[:2]), dim=-1)
print(probs.round(decimals=3), "| sums:", probs.sum(-1))

# Try it: load the checkpoint without calling eval() and compare predictions twice.
<!-- QUIZ -->
[
  {"q": "What is the recommended thing to save for a trained PyTorch model?", "options": ["The Python source file", "model.state_dict()", "The loss curve", "The DataLoader"], "answer": 1, "explain": "The state_dict holds the parameters and is independent of your code layout."},
  {"q": "Your loaded model gives different predictions on the same input each time. Likely cause?", "options": ["Wrong optimizer", "model.eval() was not called, so dropout is active", "The file is too large", "float32 precision"], "answer": 1, "explain": "In train mode dropout randomly zeroes activations."},
  {"q": "What extra items do you save to be able to resume training?", "options": ["Only the loss", "Optimizer state and the epoch counter", "Nothing, weights are enough", "The dataset"], "answer": 1, "explain": "Optimizers such as Adam keep running statistics; without them the resumed run behaves differently."}
]
