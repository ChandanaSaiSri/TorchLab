---
title: Classes and Objects
xp: 20
---
## Why classes matter for PyTorch

Every PyTorch model is a **class**. If classes feel unfamiliar, `nn.Module` will too, so learn them now.

A class is a blueprint; an **object** (instance) is something built from it. The blueprint defines:

- `__init__(self, ...)`: runs when the object is created. It stores starting data on `self`.
- **Methods**: functions inside the class. The first parameter is always `self`, the object itself.
- **Attributes**: values stored on `self`, such as `self.count`.

```python
class Counter:
    def __init__(self, start=0):
        self.count = start

    def add(self, n=1):
        self.count += n
        return self.count
```

## Inheritance

A class can build on another: `class Child(Parent):`. Call `super().__init__()` first so the parent sets itself up. Every PyTorch model does exactly this with `nn.Module`.

## Making objects callable

If a class defines `__call__`, you can use the object like a function: `layer(x)`. PyTorch models work this way: calling `model(x)` runs your `forward` method for you.

<!-- STARTER -->
class Counter:
    def __init__(self, start=0):
        self.count = start

    def add(self, n=1):
        self.count += n
        return self.count

c = Counter()
c.add(); c.add(5)
print("count:", c.count)


class Layer:
    """A tiny stand-in for how PyTorch layers behave."""
    def __init__(self, weight, bias):
        self.weight = weight
        self.bias = bias

    def forward(self, x):
        return self.weight * x + self.bias

    def __call__(self, x):
        return self.forward(x)


class DoubleLayer(Layer):
    def __init__(self):
        super().__init__(weight=2.0, bias=0.0)


layer = Layer(3.0, 1.0)
print("layer(2) =", layer(2))
print("DoubleLayer(4) =", DoubleLayer()(4))

# Try it: add a method to Counter called reset() that sets count back to 0.
<!-- QUIZ -->
[
  {"q": "What does the self parameter refer to?", "options": ["The class itself", "The object the method is being called on", "The parent class", "A global variable"], "answer": 1, "explain": "self is the specific instance, so self.count belongs to that object."},
  {"q": "Why call super().__init__() inside a subclass's __init__?", "options": ["To make it faster", "So the parent class can set itself up", "To delete the parent", "It is optional and does nothing"], "answer": 1, "explain": "The parent's setup must run for inherited behaviour to work. nn.Module relies on this."},
  {"q": "If a class defines __call__, what can you do with its objects?", "options": ["Nothing special", "Call them like functions, e.g. layer(x)", "Copy them", "Compare them"], "answer": 1, "explain": "__call__ makes instances callable. PyTorch uses it so model(x) runs forward."}
]
