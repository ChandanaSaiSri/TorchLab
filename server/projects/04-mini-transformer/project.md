---
title: Mini Transformer
level: advanced
hours: 3
summary: Assemble a tiny GPT-style language model - positional encoding, causal attention blocks, training and text generation.
skills: Attention, Positional encoding, Transformer blocks, Autoregressive generation
---
Build the architecture behind modern language models at toy scale. The helper module `sequences.py` produces arithmetic progressions modulo 11 - for example `3 5 7 9 0 2 4 6` (start 3, step 2). The step is hidden, so predicting the next token means looking back at earlier tokens. That is exactly what attention does.

```python
from sequences import make_sequences, VOCAB, SEQ_LEN     # VOCAB = 11, SEQ_LEN = 8
data = make_sequences(2000, seed=1)                      # LongTensor (2000, 8)
```

1. **Positional encoding** - tell the model where each token sits
2. **A transformer block** - causal self-attention plus an MLP
3. **A tiny language model** - stack, train, measure
4. **Generate** - continue a sequence token by token

Finish all four to earn the **Mini Transformer** certificate and 250 XP.
