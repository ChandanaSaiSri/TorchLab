---
title: Building a Transformer
xp: 50
---
## The pieces

A transformer block combines ideas you have already met:

1. **Multi-head self-attention**: tokens exchange information.
2. **Residual connection + LayerNorm**: `x = norm(x + attention(x))`. The residual path lets gradients flow straight through deep stacks; LayerNorm stabilises scale.
3. **Feed-forward network (MLP)** applied to each position: `Linear -> GELU -> Linear`.
4. Another residual + norm.

Stack several blocks and you have the body of GPT-style models.

## Tokens in, tokens out

- An **embedding** layer maps integer token ids to vectors: `nn.Embedding(vocab, d_model)`.
- Attention itself has no sense of order, so we add **positional information**, either learned (`nn.Embedding(max_len, d_model)`) or sinusoidal.
- A final `Linear(d_model, vocab)` produces next-token logits, trained with cross-entropy.
- For next-token prediction use a **causal mask** so position `i` cannot peek at `i+1`.

## Shapes to keep in your head

`tokens (B, T)` -> embeddings `(B, T, D)` -> blocks `(B, T, D)` -> logits `(B, T, V)`.

`nn.MultiheadAttention(embed_dim, num_heads, batch_first=True)` handles splitting into heads for you. Make `embed_dim` divisible by `num_heads`.

## The training task here

A tiny model learns a cyclic pattern: given tokens `3 4 0 1 2 ...` predict the next one in the cycle `0,1,2,3,4`. It is small enough to train in seconds yet exercises every part of the architecture.

<!-- STARTER -->
import torch
from torch import nn

torch.manual_seed(0)
VOCAB, T, D, HEADS = 5, 8, 32, 2

class Block(nn.Module):
    def __init__(self, d, heads):
        super().__init__()
        self.attn = nn.MultiheadAttention(d, heads, batch_first=True)
        self.norm1 = nn.LayerNorm(d)
        self.mlp = nn.Sequential(nn.Linear(d, 4 * d), nn.GELU(), nn.Linear(4 * d, d))
        self.norm2 = nn.LayerNorm(d)

    def forward(self, x, mask):
        a, _ = self.attn(x, x, x, attn_mask=mask, need_weights=False)
        x = self.norm1(x + a)
        return self.norm2(x + self.mlp(x))

class TinyGPT(nn.Module):
    def __init__(self):
        super().__init__()
        self.tok = nn.Embedding(VOCAB, D)
        self.pos = nn.Embedding(T, D)
        self.blocks = nn.ModuleList([Block(D, HEADS) for _ in range(2)])
        self.out = nn.Linear(D, VOCAB)

    def forward(self, idx):
        B, L = idx.shape
        x = self.tok(idx) + self.pos(torch.arange(L))
        mask = torch.triu(torch.ones(L, L, dtype=torch.bool), diagonal=1)   # causal
        for blk in self.blocks:
            x = blk(x, mask)
        return self.out(x)

def batch(n):
    start = torch.randint(0, VOCAB, (n, 1))
    x = (start + torch.arange(T)) % VOCAB
    return x, (x + 1) % VOCAB                       # target: next element of the cycle

model = TinyGPT()
print("parameters:", sum(p.numel() for p in model.parameters()))
x, y = batch(4)
print("logits shape:", tuple(model(x).shape), "= (batch, seq, vocab)")

opt = torch.optim.Adam(model.parameters(), lr=0.003)
for step in range(201):
    x, y = batch(64)
    loss = nn.functional.cross_entropy(model(x).reshape(-1, VOCAB), y.reshape(-1))
    opt.zero_grad(); loss.backward(); opt.step()
    if step % 50 == 0:
        print(f"step {step:3d} loss={loss.item():.4f}")

model.eval()
with torch.no_grad():
    x, y = batch(200)
    acc = (model(x).argmax(-1) == y).float().mean().item()
print(f"next-token accuracy: {acc:.1%}")
print("example:", x[0].tolist(), "->", model(x[:1]).argmax(-1)[0].tolist())

# Try it: change the pattern to y = (x + 2) % VOCAB. Does the model still learn it?
<!-- QUIZ -->
[
  {"q": "Why does a transformer need positional embeddings?", "options": ["To make training faster", "Attention alone is order-blind; positions tell the model where each token is", "To reduce vocabulary size", "To apply dropout"], "answer": 1, "explain": "Self-attention treats tokens as a set, so order information must be added explicitly."},
  {"q": "What is the role of the residual connection x + f(x)?", "options": ["Doubles the learning rate", "Lets gradients flow directly and makes deep stacks trainable", "Removes the need for normalisation", "Masks future tokens"], "answer": 1, "explain": "The identity path gives gradients a short route through many layers."},
  {"q": "For a batch of B sequences of length T with vocab V, what are the output logits' shape?", "options": ["(B, V)", "(B, T, V)", "(T, V)", "(B, T)"], "answer": 1, "explain": "The model predicts a distribution over the vocabulary at every position."}
]
