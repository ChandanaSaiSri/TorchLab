"""Toy language-modelling data: arithmetic progressions modulo 11, e.g. 3 5 7 9 0 2 4 6 (start 3, step 2).
Each sequence has 8 tokens from a vocabulary of 11. The step (1, 2 or 3) is hidden, so a model must look back
at the previous tokens to work out what comes next -- exactly what attention is for."""
import torch

VOCAB = 11
SEQ_LEN = 8


def make_sequences(n, seed=0):
    """Return a LongTensor of shape (n, 8)."""
    g = torch.Generator().manual_seed(seed)
    start = torch.randint(0, VOCAB, (n, 1), generator=g)
    step = torch.randint(1, 4, (n, 1), generator=g)
    return (start + step * torch.arange(SEQ_LEN)) % VOCAB
