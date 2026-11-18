---
title: Scaled Dot-Product Attention
difficulty: hard
category: CNNs & Transformers
---
Implement `attention(q, k, v, causal=False)` for tensors of shape `(B, T, D)`:

`softmax(q @ k^T / sqrt(D)) @ v`

When `causal=True`, position `i` may only attend to positions `j <= i` (set the scores for `j > i` to `-inf` before the softmax).

Return only the output `(B, T, D)`. Do not use `F.scaled_dot_product_attention` or `nn.MultiheadAttention`.
<!-- STARTER -->
import math
import torch

def attention(q, k, v, causal=False):
    # TODO
    pass
<!-- SOLUTION -->
import math
import torch

def attention(q, k, v, causal=False):
    scores = q @ k.transpose(-2, -1) / math.sqrt(q.size(-1))
    if causal:
        T = scores.size(-1)
        mask = torch.triu(torch.ones(T, T, dtype=torch.bool), diagonal=1)
        scores = scores.masked_fill(mask, float("-inf"))
    return torch.softmax(scores, dim=-1) @ v
<!-- HINTS -->
Scores are `q @ k.transpose(-2, -1)`, divided by `math.sqrt(D)`. The result has shape `(B, T, T)`.
===
`torch.triu(torch.ones(T, T, dtype=torch.bool), diagonal=1)` marks the future positions. `scores.masked_fill(mask, float("-inf"))` blocks them.
===
Apply `softmax` over the last dimension (the keys), then multiply by `v`.
<!-- TESTS -->
def test_matches_pytorch():
    torch.manual_seed(0)
    q, k, v = (torch.randn(2, 5, 8) for _ in range(3))
    assert torch.allclose(attention(q, k, v), F.scaled_dot_product_attention(q, k, v), atol=1e-5)

def test_output_shape():
    q, k, v = (torch.randn(3, 4, 6) for _ in range(3))
    assert attention(q, k, v).shape == (3, 4, 6)

def test_causal_matches_pytorch():
    torch.manual_seed(1)
    q, k, v = (torch.randn(2, 6, 4) for _ in range(3))
    assert torch.allclose(attention(q, k, v, causal=True), F.scaled_dot_product_attention(q, k, v, is_causal=True), atol=1e-5)

def hidden_causal_ignores_future():
    torch.manual_seed(2)
    q, k, v = (torch.randn(1, 5, 4) for _ in range(3))
    out1 = attention(q, k, v, causal=True)
    k2, v2 = k.clone(), v.clone()
    k2[:, 3:], v2[:, 3:] = torch.randn(1, 2, 4), torch.randn(1, 2, 4)
    out2 = attention(q, k2, v2, causal=True)
    assert torch.allclose(out1[:, :3], out2[:, :3], atol=1e-6), "early positions must not depend on later tokens"

def hidden_not_cheating():
    assert not re.search(r"scaled_dot_product_attention|MultiheadAttention", __source__), "implement the math yourself"

def hidden_scaling_matters():
    q = k = v = torch.randn(1, 3, 512)
    assert torch.allclose(attention(q, k, v), F.scaled_dot_product_attention(q, k, v), atol=1e-4)
