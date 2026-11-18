---
title: Your First Training Loop
xp: 30
---
## Letting PyTorch do the bookkeeping

In the last lesson you wrote the update rule yourself. PyTorch packages each piece:

- `nn.Linear(in_features, out_features)` is a layer that holds a weight matrix and bias, and computes `x @ W.T + b`. Its parameters already have `requires_grad=True`.
- `nn.MSELoss()` is the loss function.
- `torch.optim.SGD(model.parameters(), lr=...)` applies the update rule to every parameter.

## The five lines at the heart of training

Every PyTorch training loop, from this toy to a large language model, repeats the same pattern:

```python
for epoch in range(epochs):
    pred = model(x)              # 1. forward pass
    loss = loss_fn(pred, y)      # 2. compute the loss
    optimizer.zero_grad()        # 3. clear old gradients
    loss.backward()              # 4. backward pass
    optimizer.step()             # 5. update parameters
```

The order of `zero_grad`, `backward` and `step` matters: clear, compute, apply.

## Shapes for `nn.Linear`

`nn.Linear(1, 1)` expects input of shape `(batch, 1)`, one row per example. A flat vector of 50 numbers has shape `(50,)`, so use `.unsqueeze(1)` (or `.reshape(-1, 1)`) to make it `(50, 1)`.

## Evaluating

After training, switch off gradient tracking and try the model on new data:

```python
model.eval()
with torch.no_grad():
    print(model(torch.tensor([[3.0]])))
```

<!-- STARTER -->
import torch
from torch import nn

torch.manual_seed(1)

# Same secret rule as before: y = 2x + 1
x = torch.linspace(-1, 1, 50).unsqueeze(1)   # shape (50, 1)
y = 2 * x + 1

model = nn.Linear(1, 1)
loss_fn = nn.MSELoss()
optimizer = torch.optim.SGD(model.parameters(), lr=0.1)

for epoch in range(201):
    pred = model(x)
    loss = loss_fn(pred, y)

    optimizer.zero_grad()
    loss.backward()
    optimizer.step()

    if epoch % 50 == 0:
        print(f"epoch {epoch:3d}  loss={loss.item():.6f}")

w, b = model.weight.item(), model.bias.item()
print(f"learned: w={w:.3f}, b={b:.3f}  (true: w=2, b=1)")

model.eval()
with torch.no_grad():
    print("prediction for x=3:", model(torch.tensor([[3.0]])).item(), "(true: 7)")

# Try it: swap SGD for torch.optim.Adam(model.parameters(), lr=0.05). Does it converge faster?
<!-- QUIZ -->
[
  {
    "q": "Which is the correct order inside a training step?",
    "options": [
      "backward -> zero_grad -> step",
      "zero_grad -> backward -> step",
      "step -> backward -> zero_grad",
      "step -> zero_grad -> backward"
    ],
    "answer": 1,
    "explain": "Clear stale gradients, compute fresh ones with backward, then apply them with step."
  },
  {
    "q": "What does optimizer.step() do?",
    "options": ["Computes the loss", "Computes gradients", "Updates parameters using their gradients", "Moves data to the GPU"],
    "answer": 2,
    "explain": "backward() fills in the gradients; step() uses them to update the parameters."
  },
  {
    "q": "nn.Linear(1, 1) receives a tensor of shape (50,). What should you do?",
    "options": ["Nothing, it works as is", "Reshape it to (50, 1)", "Convert it to int64", "Call .backward() on it"],
    "answer": 1,
    "explain": "Linear expects (batch, in_features). Use x.unsqueeze(1) or x.reshape(-1, 1)."
  }
]
