---
title: A first model
difficulty: medium
---
Build a plain fully connected network and measure it.

- `accuracy(model, X, y)`: fraction (a float in 0-1) of images the model classifies correctly. Switch to eval mode and use `torch.no_grad()`.
- `train_mlp(X, y, steps=600)`: flatten each image, use an MLP with one hidden layer, train with Adam (`lr=0.01`) on random mini-batches of 128, and **return the trained model**. The model must accept `(N, 1, 12, 12)` input and return `(N, 10)` scores.

It should reach **75%** on unseen data (a plain MLP struggles because digits move around the canvas).
<!-- STARTER -->
def accuracy(model, X, y):
    # TODO
    pass


def train_mlp(X, y, steps=600):
    # TODO
    pass
<!-- SOLUTION -->
def accuracy(model, X, y):
    model.eval()
    with torch.no_grad():
        return (model(X).argmax(1) == y).float().mean().item()


def train_mlp(X, y, steps=600):
    torch.manual_seed(0)
    model = nn.Sequential(nn.Flatten(), nn.Linear(144, 64), nn.ReLU(), nn.Linear(64, 10))
    opt = torch.optim.Adam(model.parameters(), lr=0.01)
    for _ in range(steps):
        idx = torch.randint(0, len(X), (128,))
        loss = nn.functional.cross_entropy(model(X[idx]), y[idx])
        opt.zero_grad()
        loss.backward()
        opt.step()
    return model
<!-- HINTS -->
`nn.Sequential(nn.Flatten(), nn.Linear(144, 64), nn.ReLU(), nn.Linear(64, 10))` is a complete model: 12 x 12 = 144 inputs.
===
Pick a random batch each step with `idx = torch.randint(0, len(X), (128,))`, then `X[idx], y[idx]`.
===
`accuracy` is `(model(X).argmax(1) == y).float().mean().item()`. Call `model.eval()` and wrap it in `torch.no_grad()`.
<!-- TESTS -->
def test_accuracy_function():
    class Always3(nn.Module):
        def forward(self, x):
            out = torch.zeros(x.shape[0], 10)
            out[:, 3] = 1.0
            return out
    y = torch.tensor([3, 3, 1, 0])
    assert abs(accuracy(Always3(), torch.zeros(4, 1, 12, 12), y) - 0.5) < 1e-6

def test_output_shape():
    X, y = make_digits(300, seed=1)
    m = train_mlp(X, y, steps=20)
    assert m(X[:5]).shape == (5, 10), f"expected (5, 10), got {tuple(m(X[:5]).shape)}"

def test_mlp_learns():
    X, y = make_digits(4000, seed=1)
    Xt, yt = make_digits(1000, seed=99)
    acc = accuracy(train_mlp(X, y), Xt, yt)
    assert acc >= 0.75, f"test accuracy {acc:.1%}; need 75%"

def hidden_returns_float():
    X, y = make_digits(100, seed=2)
    assert isinstance(accuracy(train_mlp(X, y, steps=5), X, y), float)
