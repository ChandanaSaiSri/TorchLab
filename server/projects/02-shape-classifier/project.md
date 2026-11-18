---
title: Shape Classifier
level: intermediate
hours: 2
summary: Teach a CNN to recognise circles, squares, triangles and crosses from only 60 images, using data augmentation.
skills: CNNs, Data augmentation, Overfitting, Per-class evaluation
---
Real projects rarely have enough labelled data. Here you will see how **data augmentation** makes a tiny dataset go a long way.

The helper module `shapes_data.py` draws four shapes on a 16x16 canvas:

```python
from shapes_data import make_shapes, NAMES        # NAMES = ["circle", "square", "triangle", "cross"]
X, y = make_shapes(400, seed=1, jitter=1)          # X: (400, 1, 16, 16)
```

`jitter` controls how far the shape may wander from the centre. Models trained on centred shapes struggle when shapes appear elsewhere, unless you teach them with augmentation.

1. **Write an augmentation** - random flips and shifts
2. **Train a CNN** - with an optional augmentation hook
3. **Learn from 60 images** - the payoff
4. **Find the weak spots** - per-class accuracy

Finish all four to earn the **Shape Classifier** certificate and 250 XP.
