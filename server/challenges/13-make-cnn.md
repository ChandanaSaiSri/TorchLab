---
title: Design a Small CNN
difficulty: medium
category: CNNs & Transformers
---
Write `make_cnn()` that returns an `nn.Module` for 28x28 grayscale digit images:

- input: `(B, 1, 28, 28)`
- output: `(B, 10)` (one logit per digit)
- must contain at least one `nn.Conv2d`
- must have **fewer than 50,000 parameters**

Choose the layers yourself; the tests only check these properties.
<!-- STARTER -->
import torch
from torch import nn

def make_cnn():
    # TODO: conv layers -> flatten -> linear
    pass
<!-- SOLUTION -->
import torch
from torch import nn

def make_cnn():
    return nn.Sequential(
        nn.Conv2d(1, 8, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
        nn.Conv2d(8, 16, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
        nn.Flatten(),
        nn.Linear(16 * 7 * 7, 10),
    )
<!-- HINTS -->
Pattern: `Conv2d -> ReLU -> MaxPool2d`, repeated, then `nn.Flatten()` and one `nn.Linear`.
===
With `padding=1` and kernel 3, size is unchanged; each `MaxPool2d(2)` halves it. Two pools: 28 -> 14 -> 7. So with 16 channels the Linear layer takes `16 * 7 * 7` inputs.
<!-- TESTS -->
def test_output_shape():
    out = make_cnn()(torch.randn(4, 1, 28, 28))
    assert out.shape == (4, 10), f"expected (4, 10), got {tuple(out.shape)}"

def test_has_conv_layer():
    m = make_cnn()
    assert any(isinstance(l, nn.Conv2d) for l in m.modules()), "use at least one nn.Conv2d"

def test_parameter_budget():
    n = sum(p.numel() for p in make_cnn().parameters())
    assert n < 50_000, f"{n} parameters; the limit is 50,000"

def hidden_single_image_and_grad():
    m = make_cnn()
    out = m(torch.randn(1, 1, 28, 28))
    assert out.shape == (1, 10)
    out.sum().backward()
    assert all(p.grad is not None for p in m.parameters()), "every parameter should receive a gradient"

def hidden_learns_something():
    torch.manual_seed(0)
    m = make_cnn()
    x = torch.randn(32, 1, 28, 28)
    y = torch.randint(0, 10, (32,))
    opt = torch.optim.Adam(m.parameters(), lr=0.01)
    first = F.cross_entropy(m(x), y).item()
    for _ in range(40):
        loss = F.cross_entropy(m(x), y)
        opt.zero_grad(); loss.backward(); opt.step()
    assert loss.item() < first * 0.6, "the network should be able to fit a small batch"
