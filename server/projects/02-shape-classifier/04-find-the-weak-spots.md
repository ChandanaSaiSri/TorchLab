---
title: Find the weak spots
difficulty: medium
---
One overall accuracy hides which classes fail. Write `per_class_accuracy(model, X, y)` returning a dict `{name: accuracy}` using the names in `NAMES` (`"circle"`, `"square"`, `"triangle"`, `"cross"`). Each value is the fraction of that class's images predicted correctly. If a class does not appear in `y`, give it `None`.
<!-- STARTER -->
def per_class_accuracy(model, X, y):
    # TODO
    pass
<!-- SOLUTION -->
def per_class_accuracy(model, X, y):
    model.eval()
    with torch.no_grad():
        pred = model(X).argmax(1)
    result = {}
    for c, name in enumerate(NAMES):
        mask = y == c
        result[name] = (pred[mask] == c).float().mean().item() if mask.any() else None
    return result
<!-- HINTS -->
Loop over `enumerate(NAMES)`. `mask = y == c` selects the images of one class; compare `pred[mask]` with `c`.
===
Guard against an empty class with `mask.any()` before taking the mean, otherwise you get `nan`.
<!-- TESTS -->
def test_with_a_fake_model():
    class Always0(nn.Module):
        def forward(self, x):
            out = torch.zeros(x.shape[0], 4)
            out[:, 0] = 1.0
            return out
    y = torch.tensor([0, 0, 1, 2, 3, 3])
    r = per_class_accuracy(Always0(), torch.zeros(6, 1, 16, 16), y)
    assert list(r) == NAMES, f"keys must be {NAMES}"
    assert r["circle"] == 1.0 and r["square"] == 0.0 and r["cross"] == 0.0

def hidden_missing_class_is_none():
    class Always0(nn.Module):
        def forward(self, x):
            out = torch.zeros(x.shape[0], 4)
            out[:, 0] = 1.0
            return out
    r = per_class_accuracy(Always0(), torch.zeros(2, 1, 16, 16), torch.tensor([0, 1]))
    assert r["triangle"] is None and r["cross"] is None

def hidden_overall_consistency():
    X, y = make_shapes(400, seed=9, jitter=1)
    m = train_cnn(X, y, steps=60)
    r = per_class_accuracy(m, X, y)
    counts = torch.bincount(y, minlength=4)
    weighted = sum(r[n] * counts[i].item() for i, n in enumerate(NAMES)) / len(y)
    assert abs(weighted - accuracy(m, X, y)) < 1e-5
