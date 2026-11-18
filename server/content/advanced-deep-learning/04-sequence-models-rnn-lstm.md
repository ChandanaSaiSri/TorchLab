---
title: Sequence Models: RNNs and LSTMs
xp: 40
---
## Data with order

Text, audio, sensor readings and prices are **sequences**: the order matters and lengths vary. A recurrent network reads one step at a time and carries a **hidden state**, a running summary of everything seen so far:

`h_t = f(x_t, h_{t-1})`

The same weights are applied at every step.

## RNN, LSTM, GRU

A plain RNN struggles to remember things over long spans because gradients vanish as they flow back through many steps. **LSTM** and **GRU** add *gates*, learned switches that decide what to keep, forget and output, which lets information (and gradients) travel much further. In PyTorch: `nn.RNN`, `nn.LSTM`, `nn.GRU`.

## Shapes

With `batch_first=True`, input is `(batch, seq_len, features)`. An `nn.LSTM(input_size, hidden_size)` returns:

- `output`: `(batch, seq_len, hidden)`, the hidden state at every step.
- `(h_n, c_n)`: the final hidden and cell states, `(layers, batch, hidden)`.

For "predict from the whole sequence" tasks, use the last step: `output[:, -1, :]` and feed it to a `Linear` head.

## A forecasting setup

Slide a window over a series: input is the previous 20 values, the target is the next value. The honest question is always "does it beat a trivial baseline?", such as predicting that the next value equals the last one.

Today transformers dominate many sequence tasks, but recurrent models are still compact, simple and good for streaming data.

<!-- STARTER -->
import math
import torch
from torch import nn

torch.manual_seed(0)

# Noisy sine wave, windows of 20 -> predict the next value
t = torch.arange(0, 60, 0.1)
series = torch.sin(t) + 0.05 * torch.randn_like(t)

def windows(series, size=20):
    X = torch.stack([series[i:i + size] for i in range(len(series) - size)])
    y = series[size:]
    return X.unsqueeze(-1), y.unsqueeze(-1)          # (N, 20, 1), (N, 1)

X, y = windows(series)
split = int(0.8 * len(X))
Xtr, ytr, Xte, yte = X[:split], y[:split], X[split:], y[split:]

class Forecaster(nn.Module):
    def __init__(self):
        super().__init__()
        self.lstm = nn.LSTM(input_size=1, hidden_size=32, batch_first=True)
        self.head = nn.Linear(32, 1)
    def forward(self, x):
        out, (h, c) = self.lstm(x)                   # out: (B, 20, 32)
        return self.head(out[:, -1, :])              # last time step

model = Forecaster()
out, (h, c) = model.lstm(Xtr[:4])
print("output:", tuple(out.shape), "h_n:", tuple(h.shape), "c_n:", tuple(c.shape))

opt = torch.optim.Adam(model.parameters(), lr=0.01)
for step in range(201):
    idx = torch.randint(0, len(Xtr), (64,))
    loss = nn.functional.mse_loss(model(Xtr[idx]), ytr[idx])
    opt.zero_grad(); loss.backward(); opt.step()
    if step % 50 == 0:
        print(f"step {step:3d} loss={loss.item():.4f}")

model.eval()
with torch.no_grad():
    mse = nn.functional.mse_loss(model(Xte), yte).item()
baseline = nn.functional.mse_loss(Xte[:, -1, :], yte).item()   # "next = last"
print(f"test MSE LSTM={mse:.4f} | naive 'repeat last value'={baseline:.4f}")

# Try it: swap nn.LSTM for nn.GRU. Does the code still work with the same shapes?
<!-- QUIZ -->
[
  {"q": "What does the hidden state of a recurrent network represent?", "options": ["The learning rate", "A running summary of the sequence seen so far", "The batch size", "The final prediction only"], "answer": 1, "explain": "h_t is updated at each step and carries information from earlier steps forward."},
  {"q": "With batch_first=True, what is the input shape for an LSTM?", "options": ["(seq_len, batch, features)", "(batch, seq_len, features)", "(batch, features, seq_len)", "(features, seq_len)"], "answer": 1, "explain": "batch_first=True makes the layout (batch, seq_len, features)."},
  {"q": "Why do LSTMs handle long sequences better than plain RNNs?", "options": ["They have fewer parameters", "Gates control what to keep or forget, easing vanishing gradients", "They ignore order", "They use convolutions"], "answer": 1, "explain": "The gating mechanism lets information and gradients flow across many steps."}
]
