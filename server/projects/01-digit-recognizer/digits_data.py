"""Synthetic handwritten-style digits: 5x7 glyphs drawn on a 12x12 canvas with random position, brightness and noise."""
import torch

_GLYPHS = {
    0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    5: ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    6: ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
    7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    9: ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
}
GLYPH = torch.stack([torch.tensor([[float(c) for c in row] for row in _GLYPHS[d]]) for d in range(10)])  # (10, 7, 5)


def make_digits(n, seed=0, noise=0.25, max_shift=2):
    """Return images X of shape (n, 1, 12, 12) with values around 0..1 and labels y of shape (n,)."""
    g = torch.Generator().manual_seed(seed)
    y = torch.randint(0, 10, (n,), generator=g)
    X = torch.zeros(n, 1, 12, 12)
    for i in range(n):
        top = 2 + int(torch.randint(-max_shift, max_shift + 1, (1,), generator=g))
        left = 3 + int(torch.randint(-max_shift, max_shift + 1, (1,), generator=g))
        brightness = 0.7 + 0.3 * float(torch.rand(1, generator=g))
        X[i, 0, top:top + 7, left:left + 5] = GLYPH[y[i]] * brightness
    X = X + noise * torch.randn(X.shape, generator=g)
    return X, y
