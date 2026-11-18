---
title: Evaluation Metrics Beyond Accuracy
xp: 35
---
## Accuracy can lie

Suppose only 2% of transactions are fraud. A model that always says "not fraud" is 98% accurate and completely useless. When classes are imbalanced, you need metrics that look at the kinds of mistakes.

## The confusion matrix (binary)

|  | Predicted positive | Predicted negative |
|--|---|---|
| **Actually positive** | True Positive (TP) | False Negative (FN) |
| **Actually negative** | False Positive (FP) | True Negative (TN) |

From these four counts:

- **Accuracy** = (TP + TN) / total
- **Precision** = TP / (TP + FP): when the model says positive, how often is it right?
- **Recall** = TP / (TP + FN): of all real positives, how many did it find?
- **F1** = harmonic mean of precision and recall: `2PR / (P + R)`.

## Which to prioritise

- A cancer screening test wants **high recall**: missing a case is costly.
- A spam filter wants **high precision**: deleting a real email is costly.

## Thresholds

A sigmoid model outputs probabilities; the 0.5 cut-off is a choice. Lowering it raises recall and lowers precision; raising it does the opposite. Plot or print metrics at several thresholds to pick one that fits your costs.

## Multi-class

Build a `K x K` confusion matrix (rows true class, columns predicted) and compute per-class precision and recall from it.

<!-- STARTER -->
import torch

torch.manual_seed(0)

# 1000 examples, only ~5% positive. Probabilities from a pretend model.
y_true = (torch.rand(1000) < 0.05).long()
noise = torch.rand(1000) * 0.5
probs = torch.where(y_true == 1, 0.45 + noise, noise)         # positives score higher on average

def metrics(y_true, y_pred):
    tp = ((y_pred == 1) & (y_true == 1)).sum().item()
    fp = ((y_pred == 1) & (y_true == 0)).sum().item()
    fn = ((y_pred == 0) & (y_true == 1)).sum().item()
    tn = ((y_pred == 0) & (y_true == 0)).sum().item()
    acc = (tp + tn) / len(y_true)
    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    return tp, fp, fn, tn, acc, prec, rec, f1

always_negative = torch.zeros(1000, dtype=torch.long)
tp, fp, fn, tn, acc, prec, rec, f1 = metrics(y_true, always_negative)
print(f"always 'negative': accuracy={acc:.1%} recall={rec:.1%}  <- looks great, finds nothing")

print("\nthreshold   TP   FP   FN    acc   prec    rec     f1")
for thr in [0.3, 0.5, 0.7, 0.9]:
    tp, fp, fn, tn, acc, prec, rec, f1 = metrics(y_true, (probs > thr).long())
    print(f"   {thr:.1f}   {tp:4d} {fp:4d} {fn:4d}  {acc:.3f}  {prec:.3f}  {rec:.3f}  {f1:.3f}")

# Try it: a multi-class confusion matrix with torch.bincount(true * K + pred, minlength=K*K).reshape(K, K)
<!-- QUIZ -->
[
  {"q": "A model predicts 'not fraud' for everything on a dataset that is 98% not fraud. Its accuracy is...", "options": ["2%", "50%", "98%", "100%"], "answer": 2, "explain": "It is right on every non-fraud case, so 98%. That is why accuracy alone misleads on imbalanced data."},
  {"q": "Recall answers which question?", "options": ["Of predicted positives, how many are correct?", "Of actual positives, how many did we find?", "How many predictions were made?", "How confident is the model?"], "answer": 1, "explain": "Recall = TP / (TP + FN)."},
  {"q": "You raise the classification threshold from 0.5 to 0.9. What usually happens?", "options": ["Precision up, recall down", "Recall up, precision down", "Both up", "Nothing changes"], "answer": 0, "explain": "A stricter threshold predicts fewer positives: those are more often right (precision up) but more real positives are missed (recall down)."}
]
