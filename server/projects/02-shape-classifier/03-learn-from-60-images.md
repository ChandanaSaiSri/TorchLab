---
title: Learn from 60 images
difficulty: hard
---
Now the experiment. Write `train_small()` that:

1. creates a tiny training set with `make_shapes(60, seed=3, jitter=0.5)`
2. trains a CNN on it **with augmentation** (reuse `train_cnn` and `augment`; 300 steps)
3. returns the model

It is tested on shapes that wander much further from the centre (`jitter=3.5`), which the tiny training set never showed. It must reach **90%**. Try it without `augment_fn` first and see how low accuracy gets.
<!-- STARTER -->
def train_small():
    # TODO
    pass
<!-- SOLUTION -->
def train_small():
    X, y = make_shapes(60, seed=3, jitter=0.5)
    return train_cnn(X, y, steps=300, augment_fn=augment)
<!-- HINTS -->
`train_cnn(X, y, steps=300, augment_fn=augment)` does everything, because you wrote it to accept an augmentation function.
===
Without augmentation the model has only ever seen centred shapes, so accuracy on shifted ones is around 40-50%. Shifting during training teaches position invariance.
<!-- TESTS -->
def test_wide_test_accuracy():
    Xt, yt = make_shapes(500, seed=77, jitter=3.5)
    acc = accuracy(train_small(), Xt, yt)
    assert acc >= 0.90, f"accuracy on shifted shapes {acc:.1%}; need 90%"

def hidden_still_good_on_centred():
    Xt, yt = make_shapes(300, seed=78, jitter=0.5)
    assert accuracy(train_small(), Xt, yt) >= 0.90

def hidden_augmentation_is_the_reason():
    X, y = make_shapes(60, seed=3, jitter=0.5)
    Xt, yt = make_shapes(500, seed=77, jitter=3.5)
    plain = accuracy(train_cnn(X, y, steps=300), Xt, yt)
    assert plain < 0.80, "sanity check: without augmentation this tiny dataset should not generalise"
