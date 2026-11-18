---
title: Generate
difficulty: hard
---
Language models write by predicting one token at a time and feeding it back in. Write `generate(model, prompt, n_new)`:

- `prompt`: LongTensor `(1, t)`
- repeat `n_new` times: run the model on the sequence so far, take the **argmax** of the logits at the last position, and append it
- return the full sequence `(1, t + n_new)`; the model must be in eval mode and no gradients are tracked
- `t + n_new` never exceeds the model's context length (8)

Then `[3, 5, 7]` (step 2 modulo 11) must continue as `9, 0, 2, 4`.
<!-- STARTER -->
def generate(model, prompt, n_new):
    # TODO
    pass
<!-- SOLUTION -->
def generate(model, prompt, n_new):
    model.eval()
    ids = prompt.clone()
    with torch.no_grad():
        for _ in range(n_new):
            nxt = model(ids)[:, -1].argmax(-1, keepdim=True)
            ids = torch.cat([ids, nxt], dim=1)
    return ids
<!-- HINTS -->
`model(ids)` gives `(1, t, vocab)`; only the last position matters: `model(ids)[:, -1]`.
===
`.argmax(-1, keepdim=True)` gives shape `(1, 1)`, which you can append with `torch.cat([ids, nxt], dim=1)`.
<!-- TESTS -->
_LM = train_lm(TinyLM(VOCAB, SEQ_LEN), make_sequences(2000, seed=1))

def test_generate_length():
    out = generate(_LM, torch.tensor([[1, 2, 3]]), 4)
    assert out.shape == (1, 7)
    assert out[:, :3].tolist() == [[1, 2, 3]], "the prompt must be kept"

def test_generate_continues_the_progression():
    out = generate(_LM, torch.tensor([[3, 5, 7]]), 4)
    assert out.tolist() == [[3, 5, 7, 9, 0, 2, 4]], f"got {out.tolist()}"

def hidden_other_steps():
    assert generate(_LM, torch.tensor([[4, 5, 6]]), 3).tolist() == [[4, 5, 6, 7, 8, 9]]
    assert generate(_LM, torch.tensor([[2, 5, 8]]), 3).tolist() == [[2, 5, 8, 0, 3, 6]]

def hidden_no_gradients_kept():
    out = generate(_LM, torch.tensor([[0, 1, 2]]), 2)
    assert not out.requires_grad
