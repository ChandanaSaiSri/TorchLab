---
title: Flatten a Batch of Images
difficulty: easy
category: Indexing & Reshaping
---
Write `flatten_images(x)` for a batch of images with shape `(B, C, H, W)`. Return shape `(B, C*H*W)`: each image becomes one row, and the batch size stays as it is.

The input may be a **non-contiguous** view (for example after `permute`), so the function must work for those too.
<!-- STARTER -->
import torch

def flatten_images(x):
    # TODO
    pass
<!-- SOLUTION -->
import torch

def flatten_images(x):
    return x.reshape(x.shape[0], -1)
<!-- HINTS -->
Keep the first dimension, and let PyTorch work out the other one with `-1`.
===
`.view` fails on non-contiguous tensors; `.reshape` handles them.
<!-- TESTS -->
def test_shape():
    x = torch.randn(4, 3, 5, 5)
    assert flatten_images(x).shape == (4, 75), f"got {tuple(flatten_images(x).shape)}"

def test_values_match_reshape():
    x = torch.arange(24.).reshape(2, 3, 2, 2)
    assert torch.equal(flatten_images(x), x.reshape(2, 12))

def hidden_non_contiguous():
    x = torch.randn(2, 4, 3, 3).permute(0, 2, 3, 1)
    assert not x.is_contiguous()
    out = flatten_images(x)
    assert out.shape == (2, 36)
    assert torch.equal(out[1], x[1].reshape(-1))

def hidden_batch_of_one():
    assert flatten_images(torch.randn(1, 1, 28, 28)).shape == (1, 784)
