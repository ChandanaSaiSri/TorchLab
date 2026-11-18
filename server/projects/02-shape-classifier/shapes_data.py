"""Synthetic shapes: filled circle, square, triangle and cross drawn on a 16x16 canvas."""
import torch

NAMES = ["circle", "square", "triangle", "cross"]


def _draw(kind, cx, cy, r):
    ys, xs = torch.meshgrid(torch.arange(16.0), torch.arange(16.0), indexing="ij")
    dx, dy = xs - cx, ys - cy
    if kind == 0:                                   # circle
        return ((dx ** 2 + dy ** 2) <= r ** 2).float()
    if kind == 1:                                   # square
        return ((dx.abs() <= r) & (dy.abs() <= r)).float()
    if kind == 2:                                   # triangle pointing up
        return ((dy >= -r) & (dy <= r) & (dx.abs() <= (dy + r) * 0.5)).float()
    return (((dx.abs() <= 1) & (dy.abs() <= r)) | ((dy.abs() <= 1) & (dx.abs() <= r))).float()   # cross


def make_shapes(n, seed=0, noise=0.1, jitter=1):
    """Images X (n, 1, 16, 16) and labels y (n,). `jitter` = how far (in pixels) the shape centre may wander from the middle."""
    g = torch.Generator().manual_seed(seed)
    y = torch.randint(0, 4, (n,), generator=g)
    X = torch.zeros(n, 1, 16, 16)
    for i in range(n):
        r = 3 + float(torch.rand(1, generator=g)) * 2.0
        cx = 7.5 + (float(torch.rand(1, generator=g)) * 2 - 1) * jitter
        cy = 7.5 + (float(torch.rand(1, generator=g)) * 2 - 1) * jitter
        X[i, 0] = _draw(int(y[i]), cx, cy, r)
    return X + noise * torch.randn(X.shape, generator=g), y
