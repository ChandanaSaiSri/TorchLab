---
title: Text to numbers
difficulty: easy
---
Neural networks read integers, not words. Write:

- `build_vocab(sentences)`: returns a dict word -> id. Reserve `"<pad>": 0` and `"<unk>": 1`, then give every distinct word (split on spaces) an id in **alphabetical order** starting at 2.
- `encode(sentence, vocab, max_len=10)`: list of exactly `max_len` ids: the word ids (unknown words -> `vocab["<unk>"]`), truncated to `max_len`, then padded on the right with `0`.
<!-- STARTER -->
import torch
from torch import nn
from sentiment_data import make_reviews


def build_vocab(sentences):
    # TODO
    pass


def encode(sentence, vocab, max_len=10):
    # TODO
    pass
<!-- SOLUTION -->
import torch
from torch import nn
from sentiment_data import make_reviews


def build_vocab(sentences):
    vocab = {"<pad>": 0, "<unk>": 1}
    for word in sorted({w for s in sentences for w in s.split()}):
        vocab[word] = len(vocab)
    return vocab


def encode(sentence, vocab, max_len=10):
    ids = [vocab.get(w, vocab["<unk>"]) for w in sentence.split()][:max_len]
    return ids + [0] * (max_len - len(ids))
<!-- HINTS -->
Collect the distinct words with a set comprehension, `sorted(...)` them, and assign `len(vocab)` as the next id so ids stay consecutive.
===
`vocab.get(word, vocab["<unk>"])` handles unseen words. Slice with `[:max_len]` first, then pad with `[0] * (max_len - len(ids))`.
<!-- TESTS -->
def test_vocab_specials_and_order():
    v = build_vocab(["b a", "c a"])
    assert v == {"<pad>": 0, "<unk>": 1, "a": 2, "b": 3, "c": 4}, f"got {v}"

def test_encode_pads_and_unknowns():
    v = build_vocab(["good movie"])
    assert encode("good movie", v, max_len=4) == [2, 3, 0, 0]
    assert encode("good film", v, max_len=3) == [2, 1, 0], "unknown words map to <unk>"

def hidden_encode_truncates():
    v = build_vocab(["a b c d e"])
    assert encode("a b c d e", v, max_len=3) == [2, 3, 4]

def hidden_real_corpus_roundtrip():
    s, _ = make_reviews(200, seed=1)
    v = build_vocab(s)
    assert 1 not in encode(s[0], v) and len(encode(s[0], v)) == 10
