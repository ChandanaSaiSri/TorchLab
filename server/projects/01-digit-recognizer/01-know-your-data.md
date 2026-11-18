---
title: Know your data
difficulty: easy
---
Before modelling, look at what you have. Write `dataset_stats(X, y)` returning a dict with:

- `"n"`: number of images (int)
- `"shape"`: shape of one image as a tuple, e.g. `(1, 12, 12)`
- `"class_counts"`: a list of 10 ints, how many images there are of each digit
- `"pixel_mean"` and `"pixel_std"`: mean and standard deviation of every pixel (floats)

`torch.bincount` is handy for the counts.
<!-- STARTER -->
import torch
from torch import nn
from digits_data import make_digits


def dataset_stats(X, y):
    # TODO
    pass
<!-- SOLUTION -->
import torch
from torch import nn
from digits_data import make_digits


def dataset_stats(X, y):
    return {
        "n": X.shape[0],
        "shape": tuple(X.shape[1:]),
        "class_counts": torch.bincount(y, minlength=10).tolist(),
        "pixel_mean": X.mean().item(),
        "pixel_std": X.std().item(),
    }
<!-- HINTS -->
`X.shape[0]` is the number of images and `tuple(X.shape[1:])` is one image's shape.
===
`torch.bincount(y, minlength=10)` counts how often each label occurs; add `.tolist()` to get plain Python ints.
<!-- TESTS -->
def test_basic_stats():
    X, y = make_digits(500, seed=3)
    s = dataset_stats(X, y)
    assert s["n"] == 500, f"n should be 500, got {s['n']}"
    assert tuple(s["shape"]) == (1, 12, 12), f"shape should be (1, 12, 12), got {s['shape']}"

def test_class_counts():
    X, y = make_digits(500, seed=3)
    s = dataset_stats(X, y)
    assert isinstance(s["class_counts"], list) and len(s["class_counts"]) == 10
    assert sum(s["class_counts"]) == 500
    assert s["class_counts"] == torch.bincount(y, minlength=10).tolist()

def hidden_pixel_stats():
    X, y = make_digits(300, seed=8)
    s = dataset_stats(X, y)
    assert abs(s["pixel_mean"] - X.mean().item()) < 1e-5
    assert abs(s["pixel_std"] - X.std().item()) < 1e-4

def hidden_missing_class():
    y = torch.tensor([0, 0, 1, 3])
    X = torch.zeros(4, 1, 12, 12)
    assert dataset_stats(X, y)["class_counts"] == [2, 1, 0, 1, 0, 0, 0, 0, 0, 0]
