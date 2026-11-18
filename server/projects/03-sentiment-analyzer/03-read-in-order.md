---
title: Read in order
difficulty: hard
---
Give the model a memory. Write `class SentimentLSTM(nn.Module)`, constructed as `SentimentLSTM(vocab_size, emb_dim=16, hidden=32)`:

- `nn.Embedding(vocab_size, emb_dim, padding_idx=0)`
- `nn.LSTM(emb_dim, hidden, batch_first=True)`
- a `Linear(hidden, 2)` on the LSTM output **at each sentence's last real word** (not at the padding). With right-padding, the last real position of row `i` is `(x[i] != 0).sum() - 1`.

Train it with your `train_classifier` (use `steps=300`). It must reach **95%** on unseen reviews, including ones with negation.
<!-- STARTER -->
class SentimentLSTM(nn.Module):
    def __init__(self, vocab_size, emb_dim=16, hidden=32):
        super().__init__()
        # TODO

    def forward(self, x):
        # TODO
        pass
<!-- SOLUTION -->
class SentimentLSTM(nn.Module):
    def __init__(self, vocab_size, emb_dim=16, hidden=32):
        super().__init__()
        self.emb = nn.Embedding(vocab_size, emb_dim, padding_idx=0)
        self.lstm = nn.LSTM(emb_dim, hidden, batch_first=True)
        self.out = nn.Linear(hidden, 2)

    def forward(self, x):
        states, _ = self.lstm(self.emb(x))
        last = (x != 0).sum(1).clamp(min=1) - 1
        return self.out(states[torch.arange(x.shape[0]), last])
<!-- HINTS -->
`states, _ = self.lstm(self.emb(x))` gives one hidden state per word: shape `(B, L, hidden)`.
===
Find each sentence's last word: `last = (x != 0).sum(1) - 1`. Then pick `states[torch.arange(B), last]` - one vector per sentence.
===
Reading the final padded position instead would feed the LSTM many meaningless pad tokens after the real words, which dilutes what it learned.
<!-- TESTS -->
def _prep(n, seed):
    s, y = make_reviews(n, seed=seed, hard=True)
    return s, y

def test_lstm_shape():
    m = SentimentLSTM(50)
    assert m(torch.randint(1, 50, (4, 10))).shape == (4, 2)
    assert any(isinstance(l, nn.LSTM) for l in m.modules()), "use nn.LSTM"

def test_lstm_accuracy():
    s, y = _prep(2000, 1)
    v = build_vocab(s)
    X = torch.tensor([encode(t, v) for t in s]); Y = torch.tensor(y)
    ts, ty = _prep(1000, 99)
    Xt = torch.tensor([encode(t, v) for t in ts]); Yt = torch.tensor(ty)
    acc = accuracy(train_classifier(SentimentLSTM(len(v)), X, Y, steps=300), Xt, Yt)
    assert acc >= 0.95, f"accuracy {acc:.1%}; need 95%"

def hidden_padding_does_not_matter():
    torch.manual_seed(0)
    m = SentimentLSTM(30).eval()
    a = torch.tensor([[5, 6, 7, 0, 0]])
    b = torch.tensor([[5, 6, 7, 0, 0, 0, 0, 0, 0]])
    with torch.no_grad():
        assert torch.allclose(m(a), m(b), atol=1e-5), "only the last real word should feed the classifier"

def hidden_order_matters():
    torch.manual_seed(0)
    m = SentimentLSTM(30).eval()
    with torch.no_grad():
        assert not torch.allclose(m(torch.tensor([[5, 6, 7]])), m(torch.tensor([[7, 6, 5]])), atol=1e-4)
