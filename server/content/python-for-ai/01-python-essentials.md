---
title: Python Essentials for ML
xp: 20
---
## The 20% of Python you use 80% of the time

Machine-learning code leans on a small set of Python features. Get comfortable with these and PyTorch code becomes easy to read.

**Core types.** `int`, `float`, `str`, `bool`, plus the containers `list` (ordered, changeable), `tuple` (ordered, fixed), `dict` (key to value) and `set` (unique items). Shapes in PyTorch are tuples; configuration is usually a dict.

**f-strings** format values into text: `f"loss={loss:.4f}"` prints a float with 4 decimals. You will use them in every training loop.

**Functions** package reusable steps. Parameters can have defaults, and you can call with keywords:

```python
def scale(values, factor=2.0):
    return [v * factor for v in values]

scale([1, 2, 3], factor=0.5)
```

**Comprehensions** build lists in one line: `[x * x for x in range(5) if x % 2 == 0]`. Dict comprehensions work the same way with `{k: v ...}`.

**Looping helpers.** `enumerate(items)` gives `(index, item)`; `zip(a, b)` walks two sequences together (think inputs and labels).

**Unpacking** lets you write `x, y = pair` and `for name, value in config.items():`.

**Errors.** A traceback is read from the bottom up: the last line says *what* went wrong, the lines above say *where*.

<!-- STARTER -->
config = {"lr": 0.1, "epochs": 3, "name": "demo"}

def scale(values, factor=2.0):
    return [v * factor for v in values]

print(scale([1, 2, 3]))
print(scale([1, 2, 3], factor=0.5))

squares = [x * x for x in range(6) if x % 2 == 0]
print("even squares:", squares)

inputs = [1.0, 2.0, 3.0]
labels = [0, 1, 1]
for i, (x, y) in enumerate(zip(inputs, labels)):
    print(f"sample {i}: x={x:.1f} label={y}")

for key, value in config.items():
    print(f"{key:>7} = {value}")

# Try it: build a dict mapping each number in inputs to its square using a dict comprehension.
<!-- QUIZ -->
[
  {"q": "What does zip([1, 2, 3], ['a', 'b', 'c']) let you do?", "options": ["Sort both lists", "Loop over matching pairs (1, 'a'), (2, 'b'), (3, 'c')", "Join them into one string", "Remove duplicates"], "answer": 1, "explain": "zip pairs up items by position, which is exactly how inputs and labels are walked together."},
  {"q": "What is [x * 2 for x in range(3)]?", "options": ["[0, 1, 2]", "[0, 2, 4]", "[2, 4, 6]", "[0, 2]"], "answer": 1, "explain": "range(3) yields 0, 1, 2, and each is doubled."},
  {"q": "In a Python traceback, where is the actual error message?", "options": ["The first line", "The middle", "The last line", "It is not shown"], "answer": 2, "explain": "Read from the bottom: the final line names the exception and message; the lines above show where it happened."}
]
