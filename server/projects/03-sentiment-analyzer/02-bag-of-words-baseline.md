---
title: Bag-of-words baseline
difficulty: medium
---
Build the simplest text classifier and see how far it gets.

- `class BagOfWords(nn.Module)`: constructed as `BagOfWords(vocab_size)`. `forward(x)` takes ids `(B, L)` and returns `(B, 2)` scores from a single `Linear(vocab_size, 2)` applied to word **counts** (a `(B, vocab_size)` count vector per sentence; ignore the padding id 0).
- `train_classifier(model, X, y, steps=200, lr=0.02)`: Adam, random mini-batches of 128, cross-entropy; returns the model. `X` is a LongTensor of encoded sentences.
- `accuracy(model, X, y)`.

On unseen reviews it should beat **65%** - but it will not get much further, because "not good" and "good" look alike when you only count words.
<!-- STARTER -->
def accuracy(model, X, y):
    # TODO
    pass


class BagOfWords(nn.Module):
    def __init__(self, vocab_size):
        super().__init__()
        # TODO

    def forward(self, x):
        # TODO
        pass


def train_classifier(model, X, y, steps=200, lr=0.02):
    # TODO
    pass
<!-- SOLUTION -->
def accuracy(model, X, y):
    model.eval()
    with torch.no_grad():
        return (model(X).argmax(1) == y).float().mean().item()


class BagOfWords(nn.Module):
    def __init__(self, vocab_size):
        super().__init__()
        self.vocab_size = vocab_size
        self.linear = nn.Linear(vocab_size, 2)

    def forward(self, x):
        counts = torch.zeros(x.shape[0], self.vocab_size)
        counts.scatter_add_(1, x, torch.ones_like(x, dtype=torch.float))
        counts[:, 0] = 0
        return self.linear(counts)


def train_classifier(model, X, y, steps=200, lr=0.02):
    torch.manual_seed(0)
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    model.train()
    for _ in range(steps):
        idx = torch.randint(0, len(X), (128,))
        loss = nn.functional.cross_entropy(model(X[idx]), y[idx])
        opt.zero_grad()
        loss.backward()
        opt.step()
    return model
<!-- HINTS -->
Build counts with `torch.zeros(B, vocab_size).scatter_add_(1, x, torch.ones_like(x, dtype=torch.float))`: it adds 1 at column `id` for each word.
===
Zero column 0 afterwards (`counts[:, 0] = 0`) so padding does not count as a word.
<!-- TESTS -->
def _data(n, seed):
    s, y = make_reviews(n, seed=seed, hard=True)
    return s, y

def test_bow_shape():
    s, y = _data(50, 1)
    v = build_vocab(s)
    X = torch.tensor([encode(t, v) for t in s])
    assert BagOfWords(len(v))(X[:6]).shape == (6, 2)

def test_bow_beats_chance():
    s, y = _data(2000, 1)
    v = build_vocab(s)
    X = torch.tensor([encode(t, v) for t in s]); Y = torch.tensor(y)
    ts, ty = _data(1000, 99)
    Xt = torch.tensor([encode(t, v) for t in ts]); Yt = torch.tensor(ty)
    acc = accuracy(train_classifier(BagOfWords(len(v)), X, Y), Xt, Yt)
    assert acc >= 0.65, f"accuracy {acc:.1%}; need 65%"

def hidden_counts_ignore_padding():
    s, y = _data(30, 3)
    v = build_vocab(s)
    m = BagOfWords(len(v))
    a = torch.tensor([[2, 3, 0, 0, 0]])
    b = torch.tensor([[2, 3, 0, 0, 0, 0, 0, 0]])
    assert torch.allclose(m(a), m(b)), "extra padding must not change the scores"

def hidden_order_is_ignored():
    s, y = _data(30, 3)
    v = build_vocab(s)
    m = BagOfWords(len(v))
    assert torch.allclose(m(torch.tensor([[2, 3, 4]])), m(torch.tensor([[4, 2, 3]])), atol=1e-6), "a bag of words ignores order"
