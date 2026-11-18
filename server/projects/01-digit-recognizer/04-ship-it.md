---
title: Ship it
difficulty: hard
---
Real inputs are messier than the training set. Finish the project:

- `confusion_matrix(model, X, y)`: a `(10, 10)` `LongTensor` where row = true digit and column = predicted digit (`cm[3, 5]` counts 3s that were read as 5s).
- `train_robust(X, y)`: return a trained `DigitCNN` that stays accurate on **noisier** images than it saw in training. Use your `noise_aug` option. It is tested on images with noise `0.35` (training data has noise `0.25`) and must reach **85%**.
<!-- STARTER -->
def confusion_matrix(model, X, y):
    # TODO
    pass


def train_robust(X, y):
    # TODO
    pass
<!-- SOLUTION -->
def confusion_matrix(model, X, y):
    model.eval()
    with torch.no_grad():
        pred = model(X).argmax(1)
    cm = torch.zeros(10, 10, dtype=torch.long)
    for t, p in zip(y.tolist(), pred.tolist()):
        cm[t, p] += 1
    return cm


def train_robust(X, y):
    return train_model(DigitCNN(), X, y, steps=800, noise_aug=0.25)
<!-- HINTS -->
Loop over `zip(y.tolist(), pred.tolist())` and do `cm[true, predicted] += 1` on a `torch.zeros(10, 10, dtype=torch.long)`.
===
A correct confusion matrix has the number of images as its sum and the number of correct predictions on its diagonal (`cm.trace()`).
===
Training with extra Gaussian noise (around `0.2`-`0.25`) teaches the network to ignore it. `train_model(DigitCNN(), X, y, noise_aug=0.25)` does the job.
<!-- TESTS -->
def test_confusion_matrix_basics():
    X, y = make_digits(400, seed=5)
    m = train_model(DigitCNN(), X, y, steps=60)
    cm = confusion_matrix(m, X, y)
    assert cm.shape == (10, 10)
    assert cm.sum().item() == 400, "every image must be counted once"

def test_confusion_matrix_diagonal():
    X, y = make_digits(400, seed=5)
    m = train_model(DigitCNN(), X, y, steps=60)
    cm = confusion_matrix(m, X, y)
    assert abs(cm.trace().item() / 400 - accuracy(m, X, y)) < 1e-6, "diagonal / total should equal accuracy"

def test_robust_model_survives_noise():
    X, y = make_digits(4000, seed=1)
    Xn, yn = make_digits(1000, seed=123, noise=0.35)
    acc = accuracy(train_robust(X, y), Xn, yn)
    assert acc >= 0.85, f"accuracy on noisy images {acc:.1%}; need 85%"

def hidden_confusion_direction():
    class Always7(nn.Module):
        def forward(self, x):
            out = torch.zeros(x.shape[0], 10)
            out[:, 7] = 1.0
            return out
    y = torch.tensor([1, 1, 2])
    cm = confusion_matrix(Always7(), torch.zeros(3, 1, 12, 12), y)
    assert cm[1, 7].item() == 2 and cm[2, 7].item() == 1, "rows are true labels, columns are predictions"
