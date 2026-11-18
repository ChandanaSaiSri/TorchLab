---
title: Go convolutional
difficulty: hard
---
Digits move around the canvas, and a convolution is built for that. Write:

- `class DigitCNN(nn.Module)`: two `Conv2d` + `ReLU` + `MaxPool2d(2)` stages (16 then 32 channels, kernel 3, padding 1), then flatten and two `Linear` layers (`32*3*3 -> 64 -> 10`). Input `(N, 1, 12, 12)`, output `(N, 10)`.
- `train_model(model, X, y, steps=800, lr=0.005, noise_aug=0.0)`: a general training loop (Adam, mini-batches of 128) that returns the model. When `noise_aug > 0`, add `noise_aug * torch.randn_like(batch)` to each training batch (you will need this in the final milestone).

Your CNN should reach **95%** on unseen data.
<!-- STARTER -->
class DigitCNN(nn.Module):
    def __init__(self):
        super().__init__()
        # TODO

    def forward(self, x):
        # TODO
        pass


def train_model(model, X, y, steps=800, lr=0.005, noise_aug=0.0):
    # TODO
    pass
<!-- SOLUTION -->
class DigitCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 16, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(16, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
        )
        self.head = nn.Sequential(nn.Flatten(), nn.Linear(32 * 3 * 3, 64), nn.ReLU(), nn.Linear(64, 10))

    def forward(self, x):
        return self.head(self.features(x))


def train_model(model, X, y, steps=800, lr=0.005, noise_aug=0.0):
    torch.manual_seed(0)
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    model.train()
    for _ in range(steps):
        idx = torch.randint(0, len(X), (128,))
        xb = X[idx]
        if noise_aug > 0:
            xb = xb + noise_aug * torch.randn_like(xb)
        loss = nn.functional.cross_entropy(model(xb), y[idx])
        opt.zero_grad()
        loss.backward()
        opt.step()
    return model
<!-- HINTS -->
Shapes: 12 -> pool -> 6 -> pool -> 3, so the flattened feature size is `32 * 3 * 3 = 288`.
===
Put the convolutional part in one `nn.Sequential` and the classifier in another; `forward` is then `self.head(self.features(x))`.
===
`train_model` is your MLP loop with the model passed in. Add noise only to the training batch, never to the stored data.
<!-- TESTS -->
def test_cnn_shape_and_conv():
    m = DigitCNN()
    assert m(torch.randn(4, 1, 12, 12)).shape == (4, 10)
    assert any(isinstance(l, nn.Conv2d) for l in m.modules()), "use nn.Conv2d layers"

def test_cnn_accuracy():
    X, y = make_digits(4000, seed=1)
    Xt, yt = make_digits(1000, seed=99)
    m = train_model(DigitCNN(), X, y)
    acc = accuracy(m, Xt, yt)
    assert acc >= 0.95, f"test accuracy {acc:.1%}; need 95%"

def hidden_train_model_returns_model():
    X, y = make_digits(200, seed=4)
    m = DigitCNN()
    assert train_model(m, X, y, steps=3) is m

def hidden_noise_aug_runs():
    X, y = make_digits(200, seed=4)
    X0 = X.clone()
    train_model(DigitCNN(), X, y, steps=3, noise_aug=0.2)
    assert torch.equal(X, X0), "do not modify the dataset when adding noise"
