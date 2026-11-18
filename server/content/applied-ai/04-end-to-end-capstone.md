---
title: End-to-End Capstone Workflow
xp: 60
---
## Putting it all together

Real projects follow a repeatable loop. This lesson walks the whole path on a small tabular problem so you can reuse the skeleton:

1. **Define the problem and a baseline.** Always know what "better than trivial" means (majority class, mean prediction).
2. **Split the data** into train / validation / test *before* looking at anything else. Fit scalers on train only.
3. **Build a simple model first**, make it overfit a tiny batch (sanity check), then train properly.
4. **Track validation metrics**, keep the best checkpoint, stop early.
5. **Evaluate once on the test set.** Report accuracy and per-class errors, not only a single number.
6. **Package**: save the state_dict *and* the preprocessing parameters; test reload.
7. **Serve and monitor.**

## Pitfalls this skeleton protects you from

- **Data leakage**: computing normalisation on all data lets test information into training.
- **Tuning on the test set**: use validation for decisions; touch test once.
- **Unreproducible results**: fix seeds and record versions.
- **Metric blindness**: accuracy hides class imbalance, so compare with the baseline.

<!-- STARTER -->
import io
import torch
from torch import nn

torch.manual_seed(0)

# 1. Data: two noisy concentric-ish classes in 2-D plus 2 junk features
N = 600
radius = torch.cat([torch.rand(N // 2) * 1.0, 1.5 + torch.rand(N // 2) * 1.0])
angle = torch.rand(N) * 6.2832
X = torch.stack([radius * torch.cos(angle), radius * torch.sin(angle)], 1)
X = torch.cat([X, torch.randn(N, 2)], 1) * torch.tensor([3.0, 3.0, 1.0, 1.0]) + 5
y = torch.cat([torch.zeros(N // 2), torch.ones(N // 2)]).long()

# 2. Split first, then scale using TRAIN statistics only
perm = torch.randperm(N)
tr, va, te = perm[:360], perm[360:480], perm[480:]
mean, std = X[tr].mean(0), X[tr].std(0)
norm = lambda a: (a - mean) / std
Xtr, Xva, Xte = norm(X[tr]), norm(X[va]), norm(X[te])
ytr, yva, yte = y[tr], y[va], y[te]

baseline = max((yte == 0).float().mean().item(), (yte == 1).float().mean().item())
print(f"baseline (majority class) test accuracy: {baseline:.1%}")

# 3. Model + sanity check: it must be able to overfit 16 samples
def make():
    return nn.Sequential(nn.Linear(4, 32), nn.ReLU(), nn.Linear(32, 32), nn.ReLU(), nn.Linear(32, 2))

tiny = make(); o = torch.optim.Adam(tiny.parameters(), lr=0.01)
for _ in range(200):
    l = nn.functional.cross_entropy(tiny(Xtr[:16]), ytr[:16]); o.zero_grad(); l.backward(); o.step()
print(f"sanity: loss on 16 samples after overfitting = {l.item():.4f} (should be near 0)")

# 4. Real training with validation, best checkpoint and early stopping
model = make(); opt = torch.optim.Adam(model.parameters(), lr=0.01)
best, best_state, wait = 1e9, None, 0
for epoch in range(300):
    model.train()
    loss = nn.functional.cross_entropy(model(Xtr), ytr)
    opt.zero_grad(); loss.backward(); opt.step()
    model.eval()
    with torch.no_grad():
        vloss = nn.functional.cross_entropy(model(Xva), yva).item()
    if vloss < best - 1e-4:
        best, wait = vloss, 0
        best_state = {k: v.clone() for k, v in model.state_dict().items()}
    else:
        wait += 1
        if wait >= 25:
            print(f"early stop at epoch {epoch}, best val loss {best:.4f}")
            break
model.load_state_dict(best_state)

# 5. Final evaluation, once
model.eval()
with torch.no_grad():
    pred = model(Xte).argmax(1)
print(f"test accuracy: {(pred == yte).float().mean().item():.1%}")
for c in (0, 1):
    m = yte == c
    print(f"  class {c}: recall {(pred[m] == c).float().mean().item():.1%} ({int(m.sum())} samples)")

# 6. Package weights + preprocessing, then test the reload
buf = io.BytesIO()
torch.save({"model": model.state_dict(), "mean": mean, "std": std}, buf)
buf.seek(0)
pack = torch.load(buf)
reloaded = make(); reloaded.load_state_dict(pack["model"]); reloaded.eval()
with torch.no_grad():
    again = reloaded((X[te] - pack["mean"]) / pack["std"]).argmax(1)
print("reloaded pipeline reproduces test predictions:", bool((again == pred).all()))

# Try it: compute the scaler on ALL data instead of train only. Does the test score change? Why is it still wrong?
<!-- QUIZ -->
[
  {"q": "Why compute normalisation statistics on the training set only?", "options": ["It is faster", "Using test data would leak information into training and inflate results", "PyTorch requires it", "It improves GPU use"], "answer": 1, "explain": "Test data must stay unseen; statistics from it are a subtle form of leakage."},
  {"q": "What is the point of trying to overfit a tiny batch first?", "options": ["To get final accuracy", "To confirm the model and training loop can learn at all", "To tune the test set", "To save memory"], "answer": 1, "explain": "If it cannot memorise 16 samples, there is a bug in the model, loss or loop."},
  {"q": "Which data should you use to decide when to stop training?", "options": ["Test set", "Validation set", "Training set only", "Any, it makes no difference"], "answer": 1, "explain": "Validation guides decisions; the test set is reserved for one final unbiased estimate."}
]
