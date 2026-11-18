// Starter programs offered in the Playground. Every one of them is run in CI-style by scripts/validate-samples.mjs.
export const SAMPLES = [
  {
    id: 'tensor-basics', title: 'Tensor basics', kind: 'script', blurb: 'Create tensors, check shape and dtype, do maths and reshape.',
    code: `import torch

a = torch.tensor([[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]])
print("shape:", a.shape, "dtype:", a.dtype)

print("row sums:", a.sum(dim=1))
print("column means:", a.mean(dim=0))
print("a @ a.T =")
print(a @ a.T)

b = a.reshape(3, 2)
print("reshaped to (3, 2):")
print(b)
print("first column of b:", b[:, 0])
`,
  },
  {
    id: 'autograd', title: 'Autograd in five lines', kind: 'script', blurb: 'Let PyTorch compute a gradient for you.',
    code: `import torch

x = torch.tensor(3.0, requires_grad=True)
y = x ** 2 + 2 * x + 1      # y = (x + 1)^2
y.backward()

print("y =", y.item())
print("dy/dx at x=3 is", x.grad.item(), "(the maths says 2x + 2 = 8)")
`,
  },
  {
    id: 'linear-regression', title: 'Linear regression, step by step', kind: 'notebook', blurb: 'A notebook: data, model, training loop, plot.',
    cells: [
      `import torch
import matplotlib.pyplot as plt

torch.manual_seed(0)
x = torch.linspace(-1, 1, 60).unsqueeze(1)
y = 3 * x + 0.5 + 0.2 * torch.randn_like(x)   # the truth is y = 3x + 0.5, plus noise
print(x.shape, y.shape)`,
      `model = torch.nn.Linear(1, 1)
loss_fn = torch.nn.MSELoss()
opt = torch.optim.SGD(model.parameters(), lr=0.1)
print(model)`,
      `losses = []
for step in range(100):
    opt.zero_grad()
    loss = loss_fn(model(x), y)
    loss.backward()
    opt.step()
    losses.append(loss.item())
print("final loss:", round(losses[-1], 4))
print("learned weight and bias:", model.weight.item(), model.bias.item())`,
      `plt.figure(figsize=(5, 3))
plt.scatter(x, y, s=10, label="data")
plt.plot(x, model(x).detach(), color="red", label="fit")
plt.legend()
plt.savefig("fit.png")
print("saved fit.png")`,
    ],
  },
  {
    id: 'mlp-classifier', title: 'Tiny neural network classifier', kind: 'notebook', blurb: 'Train a small MLP to separate two blobs.',
    cells: [
      `import torch
from torch import nn

torch.manual_seed(1)
n = 200
x = torch.cat([torch.randn(n, 2) + 2, torch.randn(n, 2) - 2])
y = torch.cat([torch.zeros(n), torch.ones(n)]).long()
print(x.shape, y.shape)`,
      `model = nn.Sequential(nn.Linear(2, 16), nn.ReLU(), nn.Linear(16, 2))
opt = torch.optim.Adam(model.parameters(), lr=0.05)
loss_fn = nn.CrossEntropyLoss()
print(sum(p.numel() for p in model.parameters()), "parameters")`,
      `for epoch in range(30):
    opt.zero_grad()
    loss = loss_fn(model(x), y)
    loss.backward()
    opt.step()
    if epoch % 10 == 0:
        print(epoch, round(loss.item(), 4))`,
      `pred = model(x).argmax(dim=1)
print("accuracy:", (pred == y).float().mean().item())`,
    ],
  },
  {
    id: 'conv-shapes', title: 'How a convolution changes shapes', kind: 'script', blurb: 'Track the size of an image through conv and pooling layers.',
    code: `import torch
from torch import nn

x = torch.randn(1, 1, 28, 28)           # one grayscale 28x28 image
layers = [
    nn.Conv2d(1, 8, kernel_size=3, padding=1),
    nn.ReLU(),
    nn.MaxPool2d(2),
    nn.Conv2d(8, 16, kernel_size=3),
    nn.MaxPool2d(2),
]
for layer in layers:
    x = layer(x)
    print(f"{layer.__class__.__name__:<10} -> {tuple(x.shape)}")
`,
  },
  {
    id: 'loss-plot', title: 'Plot a training curve', kind: 'script', blurb: 'Save a matplotlib figure; it appears under the output.',
    code: `import matplotlib.pyplot as plt

loss = [1 / (1 + 0.3 * step) for step in range(30)]
plt.figure(figsize=(5, 3))
plt.plot(loss)
plt.xlabel("step")
plt.ylabel("loss")
plt.title("A made-up loss curve")
plt.savefig("loss.png")
print("saved loss.png")
`,
  },
  {
    id: 'read-csv', title: 'Read a CSV file', kind: 'script', blurb: 'Files you upload sit next to your program. This one writes its own first.',
    code: `import csv

# Upload your own file with "Datasets" on the left, then open it the same way.
with open("heights.csv", "w", newline="") as f:
    f.write("name,height_cm\\nAda,168\\nBo,181\\nCy,175\\n")

with open("heights.csv") as f:
    rows = list(csv.DictReader(f))

heights = [float(r["height_cm"]) for r in rows]
print(len(rows), "rows, mean height:", sum(heights) / len(heights))
`,
  },
  {
    id: 'runtime-info', title: 'What am I running on?', kind: 'script', blurb: 'Python and library versions, and whether a GPU is available.',
    code: `import sys
import torch

print("Python:", sys.version.split()[0])
print("PyTorch:", torch.__version__)
print("GPU available:", torch.cuda.is_available())
print("CPU threads:", torch.get_num_threads())
`,
  },
];
