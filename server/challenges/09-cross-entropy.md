---
title: Cross-Entropy from Scratch
difficulty: medium
category: Loss Functions
---
Implement `cross_entropy(logits, targets)`:

- `logits`: float tensor `(B, C)`, raw scores
- `targets`: long tensor `(B,)`, the correct class index of each sample
- returns the **mean** negative log-probability of the correct class, as a scalar

It must be numerically stable (use the log-sum-exp trick) and differentiable. Do not use `F.cross_entropy`, `log_softmax`, `nll_loss` or `nn.CrossEntropyLoss`.

For one sample: `loss = logsumexp(logits) - logits[target]`.
<!-- STARTER -->
import torch

def cross_entropy(logits, targets):
    # TODO
    pass
<!-- SOLUTION -->
import torch

def cross_entropy(logits, targets):
    m = logits.max(dim=1, keepdim=True).values
    logsumexp = (logits - m).exp().sum(dim=1).log() + m.squeeze(1)
    correct = logits.gather(1, targets.unsqueeze(1)).squeeze(1)
    return (logsumexp - correct).mean()
<!-- HINTS -->
`logits.gather(1, targets.unsqueeze(1))` picks, for every row, the score of its correct class.
===
Compute `logsumexp` stably: subtract the row max, take `exp`, sum, take `log`, then add the max back.
===
Result per sample is `logsumexp(row) - correct_score`; the loss is the mean over the batch.
<!-- TESTS -->
def test_matches_pytorch():
    torch.manual_seed(0)
    logits = torch.randn(8, 5)
    targets = torch.randint(0, 5, (8,))
    assert torch.allclose(cross_entropy(logits, targets), F.cross_entropy(logits, targets), atol=1e-5)

def test_scalar_output():
    out = cross_entropy(torch.randn(4, 3), torch.tensor([0, 1, 2, 0]))
    assert out.dim() == 0, "return a scalar tensor"

def test_large_logits_finite():
    logits = torch.tensor([[1000., 0., 0.], [0., 1000., 0.]])
    out = cross_entropy(logits, torch.tensor([0, 1]))
    assert torch.isfinite(out), "overflow: use the log-sum-exp trick"
    assert out.item() < 1e-3

def hidden_gradient():
    torch.manual_seed(1)
    a = torch.randn(6, 4, requires_grad=True)
    b = a.detach().clone().requires_grad_(True)
    t = torch.randint(0, 4, (6,))
    cross_entropy(a, t).backward()
    F.cross_entropy(b, t).backward()
    assert torch.allclose(a.grad, b.grad, atol=1e-5)

def hidden_no_shortcuts():
    assert not re.search(r"F\.cross_entropy|functional|log_softmax|nll_loss|CrossEntropyLoss", __source__), "write the math yourself"

def hidden_wrong_confident():
    logits = torch.tensor([[10., 0.]])
    assert abs(cross_entropy(logits, torch.tensor([1])).item() - 10.0000454) < 1e-3
