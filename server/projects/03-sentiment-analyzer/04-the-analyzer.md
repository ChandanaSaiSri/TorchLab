---
title: The analyzer
difficulty: hard
---
Wrap everything into a reusable class. `SentimentAnalyzer(sentences, labels)`:

- builds the vocabulary and trains a `SentimentLSTM` (`steps=300`) in `__init__`
- `predict(sentence)` returns `"positive"` or `"negative"`
- `evaluate(sentences, labels)` returns a dict with `"accuracy"`, `"precision"`, `"recall"` and `"f1"`, where **positive (1)** is the class of interest:
  - precision = TP / (TP + FP), recall = TP / (TP + FN), f1 = 2PR / (P + R)
  - use `0.0` when a denominator is zero

It is trained on 2000 hard reviews (`make_reviews(2000, seed=1, hard=True)`) and must reach **93%** accuracy on fresh ones.
<!-- STARTER -->
class SentimentAnalyzer:
    def __init__(self, sentences, labels):
        # TODO
        pass

    def predict(self, sentence):
        # TODO
        pass

    def evaluate(self, sentences, labels):
        # TODO
        pass
<!-- SOLUTION -->
class SentimentAnalyzer:
    def __init__(self, sentences, labels):
        self.vocab = build_vocab(sentences)
        X = torch.tensor([encode(s, self.vocab) for s in sentences])
        self.model = train_classifier(SentimentLSTM(len(self.vocab)), X, torch.tensor(labels), steps=300)

    def _predict_ids(self, sentences):
        self.model.eval()
        X = torch.tensor([encode(s, self.vocab) for s in sentences])
        with torch.no_grad():
            return self.model(X).argmax(1).tolist()

    def predict(self, sentence):
        return "positive" if self._predict_ids([sentence])[0] == 1 else "negative"

    def evaluate(self, sentences, labels):
        pred = self._predict_ids(sentences)
        tp = sum(1 for p, t in zip(pred, labels) if p == 1 and t == 1)
        fp = sum(1 for p, t in zip(pred, labels) if p == 1 and t == 0)
        fn = sum(1 for p, t in zip(pred, labels) if p == 0 and t == 1)
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        return {"accuracy": sum(p == t for p, t in zip(pred, labels)) / len(labels),
                "precision": precision, "recall": recall, "f1": f1}
<!-- HINTS -->
In `__init__`: `self.vocab = build_vocab(sentences)`, encode everything into a LongTensor, then `train_classifier(SentimentLSTM(len(self.vocab)), X, y, steps=300)`.
===
Write one private helper that turns a list of sentences into predicted class ids; `predict` and `evaluate` can both use it.
===
Count TP/FP/FN with generator expressions over `zip(pred, labels)`, and guard each division so an empty denominator gives `0.0`.
<!-- TESTS -->
_S, _Y = make_reviews(2000, seed=1, hard=True)
_TS, _TY = make_reviews(1000, seed=123, hard=True)
_AN = SentimentAnalyzer(_S, _Y)

def test_accuracy_on_fresh_reviews():
    r = _AN.evaluate(_TS, _TY)
    assert r["accuracy"] >= 0.93, f"accuracy {r['accuracy']:.1%}; need 93%"

def test_predict_handles_negation():
    assert _AN.predict("the movie was not good") == "negative"
    assert _AN.predict("the plot was not bad") == "positive"
    assert _AN.predict("the acting was really excellent") == "positive"

def test_metrics_are_consistent():
    r = _AN.evaluate(_TS, _TY)
    assert set(r) >= {"accuracy", "precision", "recall", "f1"}
    assert all(0.0 <= r[k] <= 1.0 for k in ("accuracy", "precision", "recall", "f1"))
    expected = 2 * r["precision"] * r["recall"] / (r["precision"] + r["recall"])
    assert abs(r["f1"] - expected) < 1e-6

def hidden_metric_math():
    pred = [_AN.predict(s) == "positive" for s in _TS[:300]]
    labels = _TY[:300]
    tp = sum(1 for p, t in zip(pred, labels) if p and t == 1)
    fp = sum(1 for p, t in zip(pred, labels) if p and t == 0)
    fn = sum(1 for p, t in zip(pred, labels) if (not p) and t == 1)
    r = _AN.evaluate(_TS[:300], labels)
    assert abs(r["precision"] - (tp / (tp + fp) if tp + fp else 0.0)) < 1e-6
    assert abs(r["recall"] - (tp / (tp + fn) if tp + fn else 0.0)) < 1e-6

def hidden_unknown_words_do_not_crash():
    assert _AN.predict("zorp blargh") in ("positive", "negative")
