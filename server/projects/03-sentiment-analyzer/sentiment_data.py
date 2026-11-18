"""A small synthetic review corpus. Sentences are built from templates, so the data is clean but still contains
the classic traps of sentiment analysis: negation ("not good") and intensifiers ("really not great")."""
import random

POSITIVE = ["good", "great", "excellent", "wonderful", "fantastic", "lovely", "brilliant", "delightful", "amazing", "superb"]
NEGATIVE = ["bad", "awful", "terrible", "boring", "dreadful", "horrible", "dull", "poor", "weak", "disappointing"]
SUBJECTS = ["the movie", "this film", "the plot", "the acting", "the soundtrack", "the story", "the ending", "the dialogue", "the cast"]
VERBS = ["was", "felt", "seemed", "looked"]
INTENSIFIERS = ["", "", "very", "really", "quite", "truly"]


def make_reviews(n, seed=0, negation_rate=0.3, hard=False):
    """Return (sentences, labels). label 1 = positive, 0 = negative.
    With hard=True some negations use the longer form 'not at all'."""
    rnd = random.Random(seed)
    sentences, labels = [], []
    for _ in range(n):
        positive = rnd.random() < 0.5
        negated = rnd.random() < negation_rate
        word = rnd.choice(POSITIVE if positive else NEGATIVE)
        intens = rnd.choice(INTENSIFIERS)
        subject, verb = rnd.choice(SUBJECTS), rnd.choice(VERBS)
        if negated:
            neg = "not at all" if (hard and rnd.random() < 0.4) else "not"
            words = [subject, verb, neg] + ([intens] if intens and neg == "not" else []) + [word]
            label = 0 if positive else 1                      # "not good" -> negative, "not bad" -> positive
        else:
            words = [subject, verb] + ([intens] if intens else []) + [word]
            label = 1 if positive else 0
        sentences.append(" ".join(words))
        labels.append(label)
    return sentences, labels
