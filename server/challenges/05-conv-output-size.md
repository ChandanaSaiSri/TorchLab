---
title: Convolution Output Size
difficulty: easy
category: CNNs & Transformers
---
Write `conv_out_size(n, k, stride=1, padding=0)` that returns the height (or width) of the output of a convolution over an input of size `n` with kernel size `k`.

Your function will be compared against what `nn.Conv2d` really produces. Return a plain Python `int`.
<!-- STARTER -->
import torch
from torch import nn

def conv_out_size(n, k, stride=1, padding=0):
    # TODO
    pass
<!-- SOLUTION -->
import torch
from torch import nn

def conv_out_size(n, k, stride=1, padding=0):
    return (n + 2 * padding - k) // stride + 1
<!-- HINTS -->
Padding adds `padding` pixels to *both* sides, so the padded size is `n + 2*padding`.
===
The kernel can start at positions 0, `stride`, 2*`stride`, ... while it still fits. Use integer division `//` and add 1 for the first position.
<!-- TESTS -->
def _real(n, k, s, p):
    return nn.Conv2d(1, 1, k, stride=s, padding=p)(torch.zeros(1, 1, n, n)).shape[-1]

def test_basic():
    assert conv_out_size(28, 3) == 26, f"28 -> kernel 3 should give 26, got {conv_out_size(28, 3)}"

def test_returns_int():
    assert isinstance(conv_out_size(10, 3), int)

def test_padding_and_stride():
    assert conv_out_size(28, 5, stride=2, padding=2) == _real(28, 5, 2, 2)

def hidden_many_cases():
    for n, k, s, p in [(32, 3, 1, 1), (17, 4, 3, 0), (64, 7, 2, 3), (9, 9, 1, 0), (20, 3, 4, 1)]:
        assert conv_out_size(n, k, s, p) == _real(n, k, s, p), f"failed for n={n}, k={k}, stride={s}, padding={p}"
