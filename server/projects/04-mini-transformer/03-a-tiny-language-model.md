---
title: A tiny language model
difficulty: expert
---
Stack the pieces into a language model and teach it the sequences.

- `class TinyLM(nn.Module)`: `TinyLM(vocab, T, D=32, H=4, L=2)`. Token `nn.Embedding(vocab, D)` plus `positional_encoding(T, D)` (store it with `register_buffer`), then `L` `Block`s, a final `nn.LayerNorm(D)` and `nn.Linear(D, vocab)`. Input ids `(B, t)` with `t <= T`, output logits `(B, t, vocab)`.
- `train_lm(model, data, steps=400, lr=3e-3)`: Adam, random batches of 64 sequences. Inputs are `batch[:, :-1]`, targets `batch[:, 1:]` (predict the next token at every position); cross-entropy on all positions. Returns the model.
- `next_token_accuracy(model, data)`: accuracy of the next-token prediction **from position 1 onwards** (position 0 cannot know the step, so ignore it): compare predictions at positions `1..` with the true tokens at positions `2..`.

It must reach **90%**.
<!-- STARTER -->
class TinyLM(nn.Module):
    def __init__(self, vocab, T, D=32, H=4, L=2):
        super().__init__()
        # TODO

    def forward(self, ids):
        # TODO
        pass


def train_lm(model, data, steps=400, lr=3e-3):
    # TODO
    pass


def next_token_accuracy(model, data):
    # TODO
    pass
<!-- SOLUTION -->
class TinyLM(nn.Module):
    def __init__(self, vocab, T, D=32, H=4, L=2):
        super().__init__()
        self.emb = nn.Embedding(vocab, D)
        self.register_buffer("pe", positional_encoding(T, D))
        self.blocks = nn.Sequential(*[Block(D, H) for _ in range(L)])
        self.ln = nn.LayerNorm(D)
        self.head = nn.Linear(D, vocab)

    def forward(self, ids):
        x = self.emb(ids) + self.pe[: ids.shape[1]]
        return self.head(self.ln(self.blocks(x)))


def train_lm(model, data, steps=400, lr=3e-3):
    torch.manual_seed(0)
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    model.train()
    for _ in range(steps):
        batch = data[torch.randint(0, len(data), (64,))]
        logits = model(batch[:, :-1])
        loss = F.cross_entropy(logits.reshape(-1, logits.shape[-1]), batch[:, 1:].reshape(-1))
        opt.zero_grad()
        loss.backward()
        opt.step()
    return model


def next_token_accuracy(model, data):
    model.eval()
    with torch.no_grad():
        pred = model(data[:, :-1]).argmax(-1)
    return (pred[:, 1:] == data[:, 2:]).float().mean().item()
<!-- HINTS -->
`self.emb(ids) + self.pe[:ids.shape[1]]` adds the position signal; the buffer is sliced to the actual sequence length.
===
Cross-entropy wants `(N, classes)` and `(N,)`: `logits.reshape(-1, vocab)` and `targets.reshape(-1)`.
===
In `next_token_accuracy`, `pred = model(data[:, :-1]).argmax(-1)` has shape `(N, 7)`. Compare `pred[:, 1:]` with `data[:, 2:]`.
<!-- TESTS -->
def test_lm_shapes():
    m = TinyLM(VOCAB, SEQ_LEN)
    ids = torch.randint(0, VOCAB, (3, 5))
    assert m(ids).shape == (3, 5, VOCAB), "logits are (batch, length, vocab) and any length up to T must work"

def test_lm_is_causal():
    m = TinyLM(VOCAB, SEQ_LEN).eval()
    a = torch.randint(0, VOCAB, (1, 6))
    b = a.clone(); b[0, 5] = (b[0, 5] + 1) % VOCAB
    with torch.no_grad():
        assert torch.allclose(m(a)[:, :5], m(b)[:, :5], atol=1e-5), "changing the last token must not affect earlier outputs"

def test_lm_learns_the_pattern():
    torch.manual_seed(0)
    m = train_lm(TinyLM(VOCAB, SEQ_LEN), make_sequences(2000, seed=1))
    acc = next_token_accuracy(m, make_sequences(1000, seed=9))
    assert acc >= 0.90, f"next-token accuracy {acc:.1%}; need 90%"

def hidden_position_buffer_moves_with_model():
    m = TinyLM(VOCAB, SEQ_LEN)
    assert "pe" in dict(m.named_buffers()), "register the positional encoding as a buffer named 'pe'"
    assert not any(p is m.pe for p in m.parameters())

def hidden_accuracy_function_is_correct():
    class Perfect(nn.Module):
        def forward(self, ids):
            out = torch.zeros(ids.shape[0], ids.shape[1], VOCAB)
            nxt = (ids + 1) % VOCAB
            out.scatter_(2, nxt.unsqueeze(-1), 1.0)
            return out
    data = (torch.arange(8) + torch.arange(5).unsqueeze(1)) % VOCAB   # all step 1
    assert next_token_accuracy(Perfect(), data) == 1.0
