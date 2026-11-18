---
title: Sentiment Analyzer
level: intermediate
hours: 3
summary: Classify movie-review sentences as positive or negative, and discover why word order and negation need a sequence model.
skills: Tokenisation, Embeddings, LSTMs, Precision/recall/F1
---
Is "the movie was not good" positive or negative? A model that only counts words sees `good` and says positive. In this project you will build the text pipeline, hit that wall with a bag-of-words baseline, and fix it with an LSTM.

The helper module `sentiment_data.py` generates a clean review corpus with negation ("not good", "not at all bad"):

```python
from sentiment_data import make_reviews
sentences, labels = make_reviews(2000, seed=1)     # labels: 1 = positive, 0 = negative
```

1. **Text to numbers** - vocabulary and encoding
2. **Bag-of-words baseline** - and why it plateaus
3. **Read in order** - an LSTM classifier
4. **The analyzer** - a complete class with precision, recall and F1

Finish all four to earn the **Sentiment Analyzer** certificate and 250 XP.
