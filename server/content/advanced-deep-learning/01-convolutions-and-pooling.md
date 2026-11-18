---
title: Convolutions and Pooling
xp: 35
---
## Why not just use Linear layers on images?

A 28x28 image has 784 pixels. A `Linear(784, 128)` layer needs about 100,000 weights, ignores that neighbouring pixels belong together, and must relearn the same pattern (say, an edge) at every position. A **convolution** fixes both problems:

- It slides a small **kernel** (e.g. 3x3) across the image. At each position it multiplies the patch by the kernel weights and sums: a dot product with a local window.
- The **same kernel weights are reused everywhere** (weight sharing), so a feature learned in one corner is detected in any corner.

Different kernels detect different patterns: edges, corners, textures. A convolutional layer learns many kernels at once; each produces one **feature map** (output channel).

## Shapes (PyTorch is channels-first)

Images are `(batch, channels, height, width)`. `nn.Conv2d(in_channels, out_channels, kernel_size, stride=1, padding=0)` maps `(B, C_in, H, W)` to `(B, C_out, H', W')` with

`H' = floor((H + 2*padding - kernel) / stride) + 1`

With `kernel=3, padding=1, stride=1` the height and width are unchanged ("same" padding).

## Pooling

`nn.MaxPool2d(2)` keeps the largest value in each 2x2 block, halving height and width. It shrinks the data, adds a little translation tolerance, and keeps the strongest responses.

## Parameter count

`Conv2d(1, 8, 3)` has `8 * (1*3*3) + 8 = 80` parameters, regardless of image size. That is why CNNs scale to large images.

<!-- STARTER -->
import torch
import torch.nn.functional as F
from torch import nn

# A 6x6 image: dark on the left half, bright on the right half
img = torch.zeros(1, 1, 6, 6)
img[..., 3:] = 1.0

# A hand-made vertical-edge kernel (shape: out_ch, in_ch, kH, kW)
kernel = torch.tensor([[[[-1.0, 0.0, 1.0],
                         [-1.0, 0.0, 1.0],
                         [-1.0, 0.0, 1.0]]]])
out = F.conv2d(img, kernel)
print("output shape:", tuple(out.shape), "(6 - 3)/1 + 1 = 4")
print(out[0, 0])          # strong response only where the edge is

# Output-size formula
def out_size(n, k, s=1, p=0):
    return (n + 2 * p - k) // s + 1

for n, k, s, p in [(28, 3, 1, 0), (28, 3, 1, 1), (28, 5, 2, 2)]:
    conv = nn.Conv2d(1, 4, k, stride=s, padding=p)
    real = conv(torch.zeros(1, 1, n, n)).shape[-1]
    print(f"n={n} k={k} s={s} p={p}: formula={out_size(n, k, s, p)} actual={real}")

# Pooling halves the size
print("after maxpool:", tuple(nn.MaxPool2d(2)(torch.randn(1, 4, 28, 28)).shape))

# Parameter counts: conv vs linear on a 28x28 image
conv = nn.Conv2d(1, 8, 3)
lin = nn.Linear(28 * 28, 8)
print("conv params:", sum(p.numel() for p in conv.parameters()))
print("linear params:", sum(p.numel() for p in lin.parameters()))

# Try it: change padding to 1 on the first conv. What is the new output shape?
<!-- QUIZ -->
[
  {"q": "A 32x32 image goes through Conv2d(kernel=5, stride=1, padding=0). What is the output height and width?", "options": ["32", "30", "28", "27"], "answer": 2, "explain": "(32 - 5)/1 + 1 = 28."},
  {"q": "What is the main benefit of weight sharing in a convolution?", "options": ["It makes the model deeper", "The same kernel detects a pattern anywhere, using few parameters", "It removes the need for activations", "It speeds up the optimizer"], "answer": 1, "explain": "One small kernel is reused at every position, so features are detected anywhere and parameter counts stay small."},
  {"q": "What shape does PyTorch expect for a batch of 16 RGB images of 64x64?", "options": ["(16, 64, 64, 3)", "(16, 3, 64, 64)", "(3, 16, 64, 64)", "(64, 64, 3, 16)"], "answer": 1, "explain": "PyTorch uses channels-first: (batch, channels, height, width)."}
]
