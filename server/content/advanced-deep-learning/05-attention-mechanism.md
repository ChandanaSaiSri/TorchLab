---
title: The Attention Mechanism
xp: 45
---
## Looking at what matters

Recurrent models squeeze a whole sequence into one hidden state. **Attention** lets every position look directly at every other position and decide how much each matters. It is the core of transformers.

## Queries, keys and values

Each token is turned into three vectors:

- **Query (Q)**: what this token is looking for.
- **Key (K)**: what each token offers for matching.
- **Value (V)**: the information to pass on if it is matched.

## Scaled dot-product attention

`Attention(Q, K, V) = softmax(Q K^T / sqrt(d_k)) V`

1. `Q K^T` scores how well each query matches each key: shape `(seq, seq)`.
2. Dividing by `sqrt(d_k)` keeps scores from growing with dimension, which would make softmax too sharp.
3. `softmax` over the last axis turns scores into weights that sum to 1 per query.
4. Multiplying by `V` produces, for each position, a weighted average of values.

## Masking

For language models, token `i` must not see future tokens. A **causal mask** sets scores for `j > i` to `-inf` *before* softmax, so their weights become 0.

## Multi-head attention

Run several attention "heads" in parallel, each in a smaller subspace, then concatenate. Different heads can specialise in different relationships.

PyTorch provides `F.scaled_dot_product_attention(q, k, v, is_causal=...)`, a fast fused version. Writing it by hand once is the best way to understand it.

<!-- STARTER -->
import math
import torch
import torch.nn.functional as F

torch.manual_seed(0)

def attention(q, k, v, causal=False):
    d_k = q.size(-1)
    scores = q @ k.transpose(-2, -1) / math.sqrt(d_k)       # (..., seq, seq)
    if causal:
        seq = scores.size(-1)
        mask = torch.triu(torch.ones(seq, seq, dtype=torch.bool), diagonal=1)
        scores = scores.masked_fill(mask, float("-inf"))
    weights = torch.softmax(scores, dim=-1)
    return weights @ v, weights

B, T, D = 2, 5, 8
q, k, v = (torch.randn(B, T, D) for _ in range(3))

out, w = attention(q, k, v)
print("output:", tuple(out.shape), "weights:", tuple(w.shape))
print("each row of weights sums to 1:", torch.allclose(w.sum(-1), torch.ones(B, T)))

ref = F.scaled_dot_product_attention(q, k, v)
print("matches PyTorch:", torch.allclose(out, ref, atol=1e-5))

out_c, w_c = attention(q, k, v, causal=True)
ref_c = F.scaled_dot_product_attention(q, k, v, is_causal=True)
print("causal matches PyTorch:", torch.allclose(out_c, ref_c, atol=1e-5))
print("causal weights for batch 0 (upper triangle is zero):")
print(w_c[0].round(decimals=2))

# Try it: scale the scores by nothing (remove the sqrt) with D=512 and look at how peaked the softmax becomes.
<!-- QUIZ -->
[
  {"q": "Why are attention scores divided by sqrt(d_k)?", "options": ["To make the output an integer", "To stop large dimensions from producing huge scores and a too-sharp softmax", "To mask the future", "To normalise the values"], "answer": 1, "explain": "Dot products grow with dimension; scaling keeps softmax gradients healthy."},
  {"q": "What does a causal mask achieve?", "options": ["Hides past tokens", "Stops each position from attending to later positions", "Removes padding", "Speeds up softmax"], "answer": 1, "explain": "Future scores are set to -inf, so their softmax weights are 0."},
  {"q": "Attention weights for one query sum to...", "options": ["0", "1", "The sequence length", "d_k"], "answer": 1, "explain": "They come from a softmax over the keys, so they sum to 1."}
]
