---
title: A transformer block
difficulty: expert
---
Write `class Block(nn.Module)`, constructed as `Block(D, H)` (`D` = model width, `H` = heads), input and output `(B, T, D)`:

```
x = x + attention(LayerNorm(x))     # causal multi-head self-attention
x = x + mlp(LayerNorm(x))           # Linear(D, 4D) -> GELU -> Linear(4D, D)
```

The attention uses one `Linear(D, 3*D)` for q, k, v, splits into `H` heads, applies **causal** scaled dot-product attention (`F.scaled_dot_product_attention(..., is_causal=True)` is allowed), re-joins the heads and applies `Linear(D, D)`.
<!-- STARTER -->
class Block(nn.Module):
    def __init__(self, D, H):
        super().__init__()
        # TODO

    def forward(self, x):
        # TODO
        pass
<!-- SOLUTION -->
class Block(nn.Module):
    def __init__(self, D, H):
        super().__init__()
        self.H = H
        self.ln1 = nn.LayerNorm(D)
        self.ln2 = nn.LayerNorm(D)
        self.qkv = nn.Linear(D, 3 * D)
        self.proj = nn.Linear(D, D)
        self.mlp = nn.Sequential(nn.Linear(D, 4 * D), nn.GELU(), nn.Linear(4 * D, D))

    def forward(self, x):
        B, T, D = x.shape
        q, k, v = self.qkv(self.ln1(x)).split(D, dim=-1)
        q, k, v = (t.reshape(B, T, self.H, D // self.H).transpose(1, 2) for t in (q, k, v))
        att = F.scaled_dot_product_attention(q, k, v, is_causal=True)
        x = x + self.proj(att.transpose(1, 2).reshape(B, T, D))
        return x + self.mlp(self.ln2(x))
<!-- HINTS -->
Two `LayerNorm`s, one `qkv` linear, one output `proj`, and an `mlp` Sequential - all created in `__init__`.
===
Heads: `t.reshape(B, T, H, D // H).transpose(1, 2)` gives `(B, H, T, head_dim)`. Undo with `.transpose(1, 2).reshape(B, T, D)`.
===
Both sublayers add their result back to `x` (residual connections): `x = x + ...`. The LayerNorm is applied *before* each sublayer.
<!-- TESTS -->
def test_block_shape():
    assert Block(16, 4)(torch.randn(2, 5, 16)).shape == (2, 5, 16)

def test_block_is_causal():
    torch.manual_seed(0)
    b = Block(16, 4).eval()
    x1 = torch.randn(1, 6, 16)
    x2 = x1.clone(); x2[:, 4:] = torch.randn(1, 2, 16)
    with torch.no_grad():
        o1, o2 = b(x1), b(x2)
    assert torch.allclose(o1[:, :4], o2[:, :4], atol=1e-5), "earlier positions must not see later tokens"
    assert not torch.allclose(o1[:, 4:], o2[:, 4:], atol=1e-5)

def hidden_residual_connections():
    b = Block(8, 2)
    for p in b.parameters():
        nn.init.zeros_(p)
    x = torch.randn(1, 3, 8)
    # with every weight zero both sublayers output 0, so only the residual path remains
    assert torch.allclose(b(x), x, atol=1e-6), "use residual connections: x = x + sublayer(x)"

def hidden_gradients_and_layernorm():
    b = Block(8, 2)
    b(torch.randn(2, 4, 8)).sum().backward()
    assert all(p.grad is not None for p in b.parameters())
    assert sum(isinstance(m, nn.LayerNorm) for m in b.modules()) == 2

def hidden_invalid_heads():
    try:
        Block(10, 3)(torch.randn(1, 2, 10))
    except Exception:
        return
    raise AssertionError("D not divisible by H should fail")
