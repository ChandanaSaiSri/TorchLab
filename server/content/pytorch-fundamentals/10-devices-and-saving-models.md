---
title: Devices, Saving and Loading Models
xp: 30
---
## CPU vs GPU

Tensors live on a **device**. A GPU does the huge matrix math of deep learning far faster, but only when both the model and the data are on it. A tensor on the CPU and a tensor on the GPU cannot be combined: you get a "Expected all tensors to be on the same device" error.

The portable pattern:

```python
device = "cuda" if torch.cuda.is_available() else "cpu"
model = model.to(device)
xb, yb = xb.to(device), yb.to(device)
```

The platform's runner is CPU-only for now, but code written this way works unchanged on a GPU machine.

## Saving a model

Save the **state_dict**: a dictionary mapping parameter names to tensors. It is small, portable, and does not depend on your class definition being pickled.

```python
torch.save(model.state_dict(), "model.pt")

model = MyModel()                              # rebuild the same architecture
model.load_state_dict(torch.load("model.pt"))
model.eval()
```

The architecture must match, or loading fails with missing/unexpected key errors. Use `map_location="cpu"` in `torch.load` to load a GPU-trained checkpoint on a CPU-only machine.

## Checkpoints

During long training, also save the optimizer state and the epoch so you can resume: `{"epoch": e, "model": ..., "optimizer": ...}`.

<!-- STARTER -->
import torch
from torch import nn

device = "cuda" if torch.cuda.is_available() else "cpu"
print("using device:", device)

torch.manual_seed(0)
model = nn.Linear(3, 1).to(device)
x = torch.randn(4, 3, device=device)         # create data on the same device
print("output device:", model(x).device)

# Save only the weights
torch.save(model.state_dict(), "model.pt")
print("state_dict keys:", list(model.state_dict().keys()))

# Load into a fresh model of the same architecture
new_model = nn.Linear(3, 1).to(device)
print("before load equal?", torch.equal(model.weight, new_model.weight))
new_model.load_state_dict(torch.load("model.pt", map_location=device))
new_model.eval()
print("after load equal? ", torch.equal(model.weight, new_model.weight))

with torch.no_grad():
    print("same predictions:", torch.allclose(model(x), new_model(x)))

# Wrong architecture -> an error you will recognise
try:
    nn.Linear(5, 1).load_state_dict(torch.load("model.pt"))
except RuntimeError as e:
    print("mismatch error:", str(e).splitlines()[0])

# Try it: save a checkpoint dict with {"epoch": 7, "model": model.state_dict()} and load it back.
<!-- QUIZ -->
[
  {"q": "What is the recommended thing to save for a trained model?", "options": ["The whole Python script", "model.state_dict()", "The loss value", "A screenshot of the output"], "answer": 1, "explain": "state_dict holds just the parameters and is portable across code changes."},
  {"q": "You get 'Expected all tensors to be on the same device'. What is the likely cause?", "options": ["Wrong dtype", "The model and data are on different devices", "Too many layers", "A negative learning rate"], "answer": 1, "explain": "Move both the model and each batch to the same device with .to(device)."},
  {"q": "Which call loads a GPU-saved checkpoint on a CPU-only machine?", "options": ["torch.load(path, map_location='cpu')", "torch.load(path) only", "model.gpu()", "torch.save(path)"], "answer": 0, "explain": "map_location remaps stored tensors onto the available device."}
]
