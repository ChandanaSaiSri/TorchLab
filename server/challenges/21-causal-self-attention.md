---
title: Causal Multi-Head Self-Attention
difficulty: expert
category: CNNs & Transformers
---
Write an `nn.Module` called `CausalSelfAttention(d_model, n_heads)`:

- `forward(x)`: `x` has shape `(B, T, d_model)`; return the same shape
- one `nn.Linear(d_model, 3 * d_model)` produces queries, keys and values together, which you split into `n_heads` heads of size `d_model // n_heads`
- each head does scaled dot-product attention with a **causal mask**
- the heads are concatenated and passed through one `nn.Linear(d_model, d_model)` output projection
- raise `ValueError` if `d_model` is not divisible by `n_heads`

You may use `F.scaled_dot_product_attention(..., is_causal=True)` for the per-head attention.
<!-- STARTER -->
import torch
from torch import nn
import torch.nn.functional as F

class CausalSelfAttention(nn.Module):
    def __init__(self, d_model, n_heads):
        super().__init__()
        # TODO

    def forward(self, x):
        # TODO
        pass
<!-- SOLUTION -->
import torch
from torch import nn
import torch.nn.functional as F

class CausalSelfAttention(nn.Module):
    def __init__(self, d_model, n_heads):
        super().__init__()
        if d_model % n_heads != 0:
            raise ValueError("d_model must be divisible by n_heads")
        self.n_heads = n_heads
        self.qkv = nn.Linear(d_model, 3 * d_model)
        self.proj = nn.Linear(d_model, d_model)

    def forward(self, x):
        B, T, D = x.shape
        q, k, v = self.qkv(x).split(D, dim=-1)
        q, k, v = (t.reshape(B, T, self.n_heads, D // self.n_heads).transpose(1, 2) for t in (q, k, v))
        out = F.scaled_dot_product_attention(q, k, v, is_causal=True)
        out = out.transpose(1, 2).reshape(B, T, D)
        return self.proj(out)
<!-- HINTS -->
`self.qkv(x)` has shape `(B, T, 3*D)`; `.split(D, dim=-1)` gives three `(B, T, D)` tensors for q, k and v.
===
To make heads: `t.reshape(B, T, n_heads, D // n_heads).transpose(1, 2)` gives `(B, n_heads, T, head_dim)`, which is the layout `F.scaled_dot_product_attention` expects.
===
After attention, undo it with `out.transpose(1, 2).reshape(B, T, D)` to concatenate the heads, then apply the output projection.
<!-- TESTS -->
def test_shape():
    m = CausalSelfAttention(16, 4)
    assert m(torch.randn(2, 5, 16)).shape == (2, 5, 16)

def test_parameter_count():
    d = 16
    n = sum(p.numel() for p in CausalSelfAttention(d, 4).parameters())
    assert n == (3 * d * d + 3 * d) + (d * d + d), f"expected {(3*d*d+3*d)+(d*d+d)} parameters, got {n}"

def test_causality():
    torch.manual_seed(0)
    m = CausalSelfAttention(12, 3).eval()
    x1 = torch.randn(1, 6, 12)
    x2 = x1.clone()
    x2[:, 4:] = torch.randn(1, 2, 12)       # change only the last two tokens
    with torch.no_grad():
        o1, o2 = m(x1), m(x2)
    assert torch.allclose(o1[:, :4], o2[:, :4], atol=1e-5), "earlier positions must not see later tokens"
    assert not torch.allclose(o1[:, 4:], o2[:, 4:], atol=1e-5), "later positions should depend on their own tokens"

def hidden_uses_earlier_tokens():
    torch.manual_seed(1)
    m = CausalSelfAttention(8, 2).eval()
    x1 = torch.randn(1, 5, 8)
    x2 = x1.clone()
    x2[:, 0] = torch.randn(1, 8)            # change the FIRST token
    with torch.no_grad():
        assert not torch.allclose(m(x1)[:, 4], m(x2)[:, 4], atol=1e-5), "later tokens should attend to earlier ones"

def hidden_invalid_heads():
    try:
        CausalSelfAttention(10, 3)
    except ValueError:
        return
    raise AssertionError("expected ValueError when d_model % n_heads != 0")

def hidden_gradients():
    m = CausalSelfAttention(8, 2)
    m(torch.randn(2, 4, 8)).sum().backward()
    assert all(p.grad is not None for p in m.parameters())

def hidden_single_head_and_batch():
    assert CausalSelfAttention(6, 1)(torch.randn(1, 3, 6)).shape == (1, 3, 6)
