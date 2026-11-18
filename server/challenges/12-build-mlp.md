---
title: Build an MLP
difficulty: medium
category: Neural Networks
---
Write `build_mlp(sizes)` that takes a list of layer sizes such as `[4, 8, 3]` and returns an `nn.Sequential` made of `nn.Linear` layers with an `nn.ReLU` **between** them, but **no activation after the last layer** (the output is raw scores).

```python
build_mlp([4, 8, 3])
# Sequential(Linear(4, 8), ReLU(), Linear(8, 3))
```
<!-- STARTER -->
import torch
from torch import nn

def build_mlp(sizes):
    # TODO
    pass
<!-- SOLUTION -->
import torch
from torch import nn

def build_mlp(sizes):
    layers = []
    for i in range(len(sizes) - 1):
        layers.append(nn.Linear(sizes[i], sizes[i + 1]))
        if i < len(sizes) - 2:
            layers.append(nn.ReLU())
    return nn.Sequential(*layers)
<!-- HINTS -->
Loop over consecutive pairs `(sizes[i], sizes[i+1])`, adding one `nn.Linear` for each.
===
Add a `nn.ReLU()` after every Linear except the last one. Finally unpack the list: `nn.Sequential(*layers)`.
<!-- TESTS -->
def _types(m):
    return [type(l).__name__ for l in m]

def test_structure():
    m = build_mlp([4, 8, 3])
    assert isinstance(m, nn.Sequential), "return an nn.Sequential"
    assert _types(m) == ["Linear", "ReLU", "Linear"], f"got layers {_types(m)}"

def test_parameter_count():
    m = build_mlp([4, 8, 3])
    assert sum(p.numel() for p in m.parameters()) == 4 * 8 + 8 + 8 * 3 + 3

def test_forward_shape():
    assert build_mlp([4, 8, 3])(torch.randn(5, 4)).shape == (5, 3)

def hidden_deep():
    m = build_mlp([2, 16, 16, 1])
    assert _types(m) == ["Linear", "ReLU", "Linear", "ReLU", "Linear"]
    assert sum(p.numel() for p in m.parameters()) == 2 * 16 + 16 + 16 * 16 + 16 + 16 + 1

def hidden_single_layer():
    assert _types(build_mlp([10, 5])) == ["Linear"], "no ReLU after the last layer"
