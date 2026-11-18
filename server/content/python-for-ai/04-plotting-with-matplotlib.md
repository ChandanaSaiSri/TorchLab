---
title: Plotting with Matplotlib
xp: 20
---
## Seeing your data and your training

Plots are how you notice that a loss curve has stopped improving or that two classes overlap. Matplotlib is the standard library for them.

## The basic recipe

```python
import matplotlib.pyplot as plt

plt.figure(figsize=(6, 3))
plt.plot(x, y, label="curve")
plt.xlabel("x"); plt.ylabel("y")
plt.title("My plot")
plt.legend()
plt.savefig("plot.png")
```

**In TorchLab, finish every plot with `plt.savefig("name.png")`.** There is no window to show, so the platform picks up any PNG files your program saves and displays them under the output. (`plt.show()` does nothing here.)

## Plot types you will use

| Goal | Function |
|------|----------|
| Loss or accuracy over epochs | `plt.plot(values)` |
| Relationship between two variables | `plt.scatter(x, y)` |
| Distribution of values | `plt.hist(values, bins=20)` |
| Compare categories | `plt.bar(names, heights)` |

Several panels in one figure: `fig, axes = plt.subplots(1, 2)` then draw on `axes[0]` and `axes[1]`.

## Plotting tensors

Matplotlib expects NumPy-compatible data. Convert first with `.detach().numpy()` (or `.tolist()`), because tensors that track gradients cannot be converted directly.

<!-- STARTER -->
import numpy as np
import torch
import matplotlib.pyplot as plt

# A fake training run: loss decays with noise
rng = np.random.default_rng(1)
epochs = np.arange(1, 31)
loss = 2.0 * np.exp(-0.15 * epochs) + rng.normal(0, 0.03, size=epochs.size)

# A tensor with gradients must be detached before plotting
w = torch.linspace(-3, 3, 100, requires_grad=True)
parabola = (w ** 2).detach().numpy()

fig, axes = plt.subplots(1, 2, figsize=(9, 3.2))
axes[0].plot(epochs, loss, marker="o", ms=3)
axes[0].set(title="Training loss", xlabel="epoch", ylabel="loss")
axes[1].plot(w.detach().numpy(), parabola)
axes[1].set(title="y = w^2", xlabel="w")
fig.tight_layout()
fig.savefig("training.png")
print("saved training.png")

# Try it: add a histogram of rng.normal(size=500) as a third panel.
<!-- QUIZ -->
[
  {"q": "Which call makes a plot appear in TorchLab's output?", "options": ["plt.show()", "plt.savefig('name.png')", "print(plt)", "plt.close()"], "answer": 1, "explain": "There is no display window; saving a PNG lets the platform show it."},
  {"q": "A tensor has requires_grad=True. What do you need before plotting it?", "options": ["Nothing", ".detach().numpy()", "torch.save", ".backward()"], "answer": 1, "explain": "Tensors that track gradients cannot be converted directly; detach first."},
  {"q": "Which plot best shows how training loss changed over epochs?", "options": ["Histogram", "Line plot of loss vs epoch", "Pie chart", "Scatter of two random arrays"], "answer": 1, "explain": "A line plot over epochs reveals trends like plateaus or divergence."}
]
