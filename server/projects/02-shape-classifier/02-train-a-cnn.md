---
title: Train a CNN
difficulty: medium
---
Write `train_cnn(X, y, steps=300, augment_fn=None)` that builds a small CNN, trains it and **returns the model**.

Use Conv layers (e.g. `Conv2d(1,16,3,padding=1)` -> ReLU -> `MaxPool2d(2)` -> `Conv2d(16,32,3,padding=1)` -> ReLU -> `MaxPool2d(2)` -> flatten -> `Linear(512, 64)` -> ReLU -> `Linear(64, 4)`), Adam with `lr=0.01`, mini-batches of 64.

When `augment_fn` is given, apply it to **every training batch** before the forward pass: `xb = augment_fn(xb)`. Also write `accuracy(model, X, y)` returning a float.

On centred shapes (`jitter=1`) it should reach **90%** accuracy.
<!-- STARTER -->
def accuracy(model, X, y):
    # TODO
    pass


def train_cnn(X, y, steps=300, augment_fn=None):
    # TODO
    pass
<!-- SOLUTION -->
def accuracy(model, X, y):
    model.eval()
    with torch.no_grad():
        return (model(X).argmax(1) == y).float().mean().item()


def train_cnn(X, y, steps=300, augment_fn=None):
    torch.manual_seed(0)
    model = nn.Sequential(
        nn.Conv2d(1, 16, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
        nn.Conv2d(16, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
        nn.Flatten(), nn.Linear(32 * 4 * 4, 64), nn.ReLU(), nn.Linear(64, 4),
    )
    opt = torch.optim.Adam(model.parameters(), lr=0.01)
    model.train()
    for _ in range(steps):
        idx = torch.randint(0, len(X), (min(64, len(X)),))
        xb = X[idx]
        if augment_fn is not None:
            xb = augment_fn(xb)
        loss = nn.functional.cross_entropy(model(xb), y[idx])
        opt.zero_grad()
        loss.backward()
        opt.step()
    return model
<!-- HINTS -->
16 -> pool -> 8 -> pool -> 4, so after the convolutions you have 32 channels of 4x4 = 512 features for the first Linear layer.
===
Use `torch.randint(0, len(X), (64,))` to pick a batch each step. With very small datasets, cap the batch size at `len(X)`.
===
Augment the *batch* (`xb = augment_fn(xb)`), not the whole dataset, so every step sees fresh variations.
<!-- TESTS -->
def test_output_shape():
    X, y = make_shapes(100, seed=1)
    m = train_cnn(X, y, steps=5)
    assert m(X[:7]).shape == (7, 4)

def test_cnn_learns_centred_shapes():
    X, y = make_shapes(400, seed=1, jitter=1)
    Xt, yt = make_shapes(400, seed=50, jitter=1)
    acc = accuracy(train_cnn(X, y), Xt, yt)
    assert acc >= 0.90, f"accuracy {acc:.1%}; need 90%"

def hidden_augment_fn_is_used():
    calls = []
    def spy(x):
        calls.append(x.shape[0])
        return x
    X, y = make_shapes(100, seed=2)
    train_cnn(X, y, steps=4, augment_fn=spy)
    assert len(calls) == 4, f"augment_fn should be called once per step, was called {len(calls)} times"

def hidden_uses_convolutions():
    X, y = make_shapes(50, seed=2)
    assert any(isinstance(l, nn.Conv2d) for l in train_cnn(X, y, steps=2).modules())
