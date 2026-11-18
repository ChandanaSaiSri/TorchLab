---
title: Positional encoding
difficulty: medium
---
Attention treats its input as a set; without positions it cannot tell `a b` from `b a`. Write `positional_encoding(T, D)` (D even) returning a `(T, D)` tensor of sinusoids:

```
PE[pos, 2i]   = sin(pos / 10000^(2i / D))
PE[pos, 2i+1] = cos(pos / 10000^(2i / D))
```
<!-- STARTER -->
import math
import torch
from torch import nn
import torch.nn.functional as F
from sequences import make_sequences, VOCAB, SEQ_LEN


def positional_encoding(T, D):
    # TODO
    pass
<!-- SOLUTION -->
import math
import torch
from torch import nn
import torch.nn.functional as F
from sequences import make_sequences, VOCAB, SEQ_LEN


def positional_encoding(T, D):
    pos = torch.arange(T).unsqueeze(1).float()
    i = torch.arange(0, D, 2).float()
    angle = pos / (10000 ** (i / D))
    pe = torch.zeros(T, D)
    pe[:, 0::2] = torch.sin(angle)
    pe[:, 1::2] = torch.cos(angle)
    return pe
<!-- HINTS -->
`pos = torch.arange(T).unsqueeze(1)` is a column and `i = torch.arange(0, D, 2)` a row; dividing them broadcasts to `(T, D/2)`.
===
Fill even columns with `sin` and odd columns with `cos`: `pe[:, 0::2] = ...`, `pe[:, 1::2] = ...`.
<!-- TESTS -->
def test_shape_and_range():
    pe = positional_encoding(8, 16)
    assert pe.shape == (8, 16)
    assert pe.abs().max().item() <= 1.0 + 1e-6

def test_first_row():
    pe = positional_encoding(4, 6)
    assert torch.allclose(pe[0], torch.tensor([0.0, 1.0, 0.0, 1.0, 0.0, 1.0]), atol=1e-6), "position 0 is sin(0)=0, cos(0)=1"

def hidden_formula():
    pe = positional_encoding(5, 8)
    pos, i = 3, 1
    assert abs(pe[pos, 2 * i].item() - math.sin(pos / 10000 ** (2 * i / 8))) < 1e-5
    assert abs(pe[pos, 2 * i + 1].item() - math.cos(pos / 10000 ** (2 * i / 8))) < 1e-5

def hidden_positions_differ():
    pe = positional_encoding(8, 16)
    assert len({tuple(r.tolist()) for r in pe}) == 8
