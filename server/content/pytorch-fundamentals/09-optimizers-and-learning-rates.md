---
title: Optimizers and Learning Rates
xp: 30
---
## Same gradients, different update rules

The gradient says which direction to move; the **optimizer** decides how. All of them live in `torch.optim` and share the same interface: `zero_grad()`, `step()`.

| Optimizer | Idea | When to reach for it |
|-----------|------|----------------------|
| **SGD** | `param -= lr * grad` | Simple baseline; well understood |
| **SGD + momentum** | keeps a running velocity so it keeps rolling through noise and flat regions | Often much faster than plain SGD |
| **Adam** | adapts the step size per parameter using running averages of gradients | Good default; robust to the choice of `lr` |
| **AdamW** | Adam with correct weight decay | Standard for transformers |

## The learning rate matters most

Too small: slow. Too large: oscillation or divergence. For Adam, `1e-3` is a classic starting point; for SGD, `1e-2` to `1e-1` depending on the problem.

## Schedulers

A **learning-rate scheduler** changes `lr` during training, e.g. starting high and decaying so late training makes finer adjustments:

```python
sched = torch.optim.lr_scheduler.StepLR(opt, step_size=20, gamma=0.5)
# call sched.step() once per epoch, after the batches
```

## Fair comparisons

To compare optimizers, start each from identical initial weights and data. In the starter we copy the same initial model for each run.

<!-- STARTER -->
import copy
import torch
from torch import nn

torch.manual_seed(0)
x = torch.linspace(-2, 2, 100).unsqueeze(1)
y = x ** 3 - x + 0.1 * torch.randn_like(x)

base = nn.Sequential(nn.Linear(1, 32), nn.Tanh(), nn.Linear(32, 1))
loss_fn = nn.MSELoss()

def train(make_opt, epochs=150):
    model = copy.deepcopy(base)                 # identical starting weights
    opt = make_opt(model.parameters())
    for _ in range(epochs):
        loss = loss_fn(model(x), y)
        opt.zero_grad(); loss.backward(); opt.step()
    return loss.item()

print("SGD lr=0.01       :", round(train(lambda p: torch.optim.SGD(p, lr=0.01)), 4))
print("SGD momentum 0.9  :", round(train(lambda p: torch.optim.SGD(p, lr=0.01, momentum=0.9)), 4))
print("Adam lr=0.01      :", round(train(lambda p: torch.optim.Adam(p, lr=0.01)), 4))

# Learning-rate schedule
w = torch.nn.Parameter(torch.tensor(1.0))
opt = torch.optim.SGD([w], lr=1.0)
sched = torch.optim.lr_scheduler.StepLR(opt, step_size=2, gamma=0.5)
for epoch in range(6):
    print(f"epoch {epoch} lr={opt.param_groups[0]['lr']}")
    opt.step(); sched.step()

# Try it: rerun the first three with lr=0.5. Which optimizers survive?
<!-- QUIZ -->
[
  {"q": "What does momentum add to SGD?", "options": ["More parameters", "A running velocity that smooths and accelerates updates", "Random noise", "Automatic data shuffling"], "answer": 1, "explain": "Momentum accumulates past gradients so progress continues through flat or noisy regions."},
  {"q": "Which optimizer adapts the step size for each parameter?", "options": ["Plain SGD", "Adam", "None do", "StepLR"], "answer": 1, "explain": "Adam tracks running averages of each parameter's gradient to scale its step."},
  {"q": "What does a StepLR scheduler do?", "options": ["Changes the batch size", "Multiplies the learning rate by gamma every step_size epochs", "Stops training", "Resets weights"], "answer": 1, "explain": "It decays the learning rate on a fixed schedule."}
]
