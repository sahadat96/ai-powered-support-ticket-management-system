# Local AI ticket triage

`AiModule` exports the injectable `TriageService`. Call
`analyze(title: string, description: string): TriageResult` synchronously. The
public types and framework-independent model are in `domain/triage.ts`.

The category classifier is a genuine multinomial naive Bayes model trained once
per Nest service instance from 96 curated labeled English examples: 24 each for
`BILLING`, `TECHNICAL`, `ACCOUNT`, and `GENERAL`. Its learned word and adjacent
word-pair frequencies use class priors and Laplace smoothing. It requires no API
key, paid provider, Python process, external model download, or network request.
Input and model state stay in the API process.

The current model version is `nb-en-v1.0.0`. Change the version when changing the
training data, tokenizer, classification thresholds, priority rules, or templates.
There is one model version and one provider, `local-naive-bayes`.

Returned output includes category, priority, confidence, an extractive summary,
a suggested reply, explanation strings, model version, and provider. Category
inference is statistical. Priority uses explicit security, outage, blocked access,
duplicate charge, and nonurgent request rules; it is not an ML prediction. The
summary combines the submitted title with the first description sentence and is
limited to 240 characters. Replies are editable category templates, not generated
LLM responses. They never assert that an investigation or refund has happened.

Model confidence is a normalized relative category score, **not a calibrated
probability of correctness**. Word independence can make the score overconfident.
Inputs with fewer than two recognized distinct words, or under 20% recognized
vocabulary coverage, fall back to `GENERAL` with score 0.25. A leading score below
0.48 or less than 0.10 above the next class also falls back to `GENERAL`; in that
case the reported confidence is the leading category score before fallback, as
the explanation states. General review must not be mistaken for a reliable
classification. Users can correct categories and staff can override priority.

Run `npm run ai:evaluate` from `backend/` to print sample counts, accuracy,
per-category precision/recall/F1, macro F1, a confusion matrix, and misclassified
examples. `evaluate.ts` contains 32 separately written held-out cases, eight per
category; none are used for fitting. This small curated benchmark is a smoke
evaluation and does not measure accuracy on real customer tickets. Jest tests
cover typical categories, unsupported and low information input, priority rules,
common negation, deterministic operation, nonmutation, and output contracts.

Limitations: English only, a small fixed corpus, weak support for mixed-intent
tickets, and heuristic negation and priority handling. The classifier recognizes
learned word associations rather than understanding intent. Non-English,
unfamiliar, ambiguous, or adversarial text should receive manual review. Do not
use priority as an autonomous incident response system. Real deployment should
evaluate a representative consented ticket dataset, review errors, and calibrate
confidence before making reliability claims.
