---
title: Write an augmentation
difficulty: medium
---
Write `augment(x, generator=None)` for a batch `x` of shape `(N, 1, H, W)`. For **each image independently**:

- flip it left-right with probability 0.5 (`img.flip(-1)`)
- shift it by a random whole number of pixels between -3 and 3 in each direction, wrapping around the edges (`torch.roll`)

Return a **new** tensor (do not modify `x`). All randomness must come from the optional `generator` so results are reproducible: `torch.rand(1, generator=generator)` and `torch.randint(-3, 4, (2,), generator=generator)`.
<!-- STARTER -->
import torch
from torch import nn
from shapes_data import make_shapes, NAMES


def augment(x, generator=None):
    # TODO
    pass
<!-- SOLUTION -->
import torch
from torch import nn
from shapes_data import make_shapes, NAMES


def augment(x, generator=None):
    out = x.clone()
    for i in range(out.shape[0]):
        img = out[i]
        if torch.rand(1, generator=generator).item() < 0.5:
            img = img.flip(-1)
        dy, dx = torch.randint(-3, 4, (2,), generator=generator).tolist()
        out[i] = img.roll(shifts=(dy, dx), dims=(-2, -1))
    return out
<!-- HINTS -->
Start with `out = x.clone()` and loop `for i in range(out.shape[0])`, so the original is untouched and each image gets its own random choices.
===
`img.roll(shifts=(dy, dx), dims=(-2, -1))` moves the image by `dy` rows and `dx` columns with wrap-around.
===
Draw the flip decision with `torch.rand(1, generator=generator).item() < 0.5` and the shifts with `torch.randint(-3, 4, (2,), generator=generator).tolist()`.
<!-- TESTS -->
def test_shape_and_original_untouched():
    X, y = make_shapes(10, seed=1)
    X0 = X.clone()
    out = augment(X)
    assert out.shape == X.shape
    assert torch.equal(X, X0), "augment must not modify its input"

def test_reproducible_with_generator():
    X, y = make_shapes(10, seed=1)
    a = augment(X, torch.Generator().manual_seed(5))
    b = augment(X, torch.Generator().manual_seed(5))
    assert torch.equal(a, b), "same generator seed must give the same result"

def test_pixels_are_only_moved():
    X, y = make_shapes(10, seed=1)
    out = augment(X, torch.Generator().manual_seed(2))
    assert torch.allclose(out.flatten(1).sort(1).values, X.flatten(1).sort(1).values), "flips and rolls only rearrange pixels"
    assert not torch.equal(out, X), "images should change"

def hidden_independent_per_image():
    X = make_shapes(1, seed=3)[0].repeat(40, 1, 1, 1)
    out = augment(X, torch.Generator().manual_seed(0))
    distinct = {tuple(o.flatten().tolist()) for o in out}
    assert len(distinct) > 10, "each image needs its own random flip and shift"

def hidden_shift_range():
    X = torch.zeros(300, 1, 16, 16)
    X[:, 0, 8, 7:9] = 1.0                          # a flip-symmetric pair of pixels, centre at (8, 7.5)
    out = augment(X, torch.Generator().manual_seed(1))
    idx = torch.arange(16.0)
    rows = (out[:, 0].sum(2) * idx).sum(1) / out[:, 0].sum((1, 2))
    cols = (out[:, 0].sum(1) * idx).sum(1) / out[:, 0].sum((1, 2))
    assert (rows - 8).abs().max().item() <= 3 + 1e-4 and (cols - 7.5).abs().max().item() <= 3 + 1e-4, "shift by at most 3 pixels"
    assert (rows - 8).abs().max().item() > 2.5, "shifts of 3 should occur"
