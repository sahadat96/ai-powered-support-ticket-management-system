# Local AI implementation and evaluation

The `ai` module provides ticket category classification without a paid API key or
external service. `TriageService.analyze(title, description)` returns category,
priority, confidence, summary, suggested reply, explanations, model version, and
provider. The ticket use case saves this result with the ticket so staff can
inspect the recommendation and rerun or apply it explicitly.

## What is learned and what is deterministic

Category selection uses a genuine multinomial naive Bayes classifier. On service
initialization, the model learns class priors and word/adjacent-word frequencies
from a labeled English corpus. Inference sums log likelihoods with add-one
Laplace smoothing and converts the class scores into relative scores. It does
not match a fixed category by keyword rules or claim to invoke an LLM.

| Output          | Method                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------ |
| Category        | Trained multinomial naive Bayes over English word and word-pair features                         |
| Confidence      | Normalized relative class score; uncalibrated                                                    |
| Priority        | Explicit security, service outage, blocked access, duplicate charge, and nonurgent request rules |
| Summary         | Title and first description sentence, truncated to 240 characters                                |
| Suggested reply | Editable category template with requests for relevant details                                    |
| Explanation     | Learned category signals, fallback reason if used, matching priority rule, and confidence caveat |

The provider is `local-naive-bayes`, and the current model version is
`nb-en-v1.0.0`. The model is fitted once per Nest service instance; request
processing makes no network calls. Fitting and inference are deterministic and
do not mutate the training examples. No customer ticket is added to the training
corpus automatically. The suggested reply never asserts that a refund, fix, or
investigation has already happened.

## Corpus and held-out split

The repository includes 96 curated training examples in
`backend/src/modules/ai/infrastructure/training-data.ts`: 24 for each category.
`backend/src/modules/ai/evaluate.ts` contains 32 separately written held-out
examples, eight per category. Those evaluation sentences are not used for model
fitting. Both sets are handcrafted English examples of common support requests;
they are not independently collected customer data.

From `backend/`, run:

```bash
npm run ai:evaluate
```

The command prints training/evaluation counts, accuracy, per-category precision,
recall and F1, macro F1, the confusion matrix, and any misclassified cases. The
verified result for this version is:

| Category  | Training examples | Held-out examples | Precision | Recall |   F1 |
| --------- | ----------------: | ----------------: | --------: | -----: | ---: |
| BILLING   |                24 |                 8 |      1.00 |   1.00 | 1.00 |
| TECHNICAL |                24 |                 8 |      1.00 |   1.00 | 1.00 |
| ACCOUNT   |                24 |                 8 |      1.00 |   1.00 | 1.00 |
| GENERAL   |                24 |                 8 |      1.00 |   1.00 | 1.00 |

Overall accuracy is **32/32 (100%)** and macro F1 is **1.00 on this small curated
benchmark**. These results are a development smoke check. They do not establish
accuracy on production tickets, on different writing styles, or on non-English
input. Shared authorship and topic vocabulary make this an easier benchmark than
an independent real-world evaluation.

The matrix uses actual classes as rows and predicted classes as columns:

| Actual / predicted | BILLING | TECHNICAL | ACCOUNT | GENERAL |
| ------------------ | ------: | --------: | ------: | ------: |
| BILLING            |       8 |         0 |       0 |       0 |
| TECHNICAL          |       0 |         8 |       0 |       0 |
| ACCOUNT            |       0 |         0 |       8 |       0 |
| GENERAL            |       0 |         0 |       0 |       8 |

## Fallback behavior and confidence

The model assigns `GENERAL` for manual review when there are fewer than two
recognized distinct words or recognized words cover less than 20% of distinct
input words. Those low-information and unfamiliar cases receive a score of 0.25.
It also falls back to `GENERAL` when the leading class score is below 0.48 or its
margin over the second class is below 0.10. In the latter case, `confidence`
reports the leading score before fallback, and the explanation says so; it is
not an estimated probability that the fallback category is correct.

Naive Bayes assumes independent features, and correlated words or word pairs can
inflate confidence. The displayed value must therefore be described as a model
score, not a calibrated correctness probability. Repeated terms are capped and
the model limits input length, but this is not a defense against all adversarial
or mixed-intent text. Category and priority remain editable by authorized staff.

## Tests and practical limits

The 20 focused domain tests cover held-out category examples, empty text,
gibberish, unsupported script, one-word requests, a widespread production outage,
account compromise, duplicate charges, blocked login, common negated and planned
incidents, deterministic output, nonmutation, summary bounds, output metadata,
and invalid training corpora. They can be run with:

```bash
npm test -- --runTestsByPath src/modules/ai/domain/triage.spec.ts
```

Priority negation handling is intentionally limited to common nearby phrases.
Neither those rules nor category inference reliably understand nuanced intent.
An English-trained small corpus can miss paraphrases, new products, and
multi-issue requests. General fallback is a route to review, not evidence of
understanding. Before claiming deployment reliability, evaluate a representative
independent consented ticket dataset, inspect class-specific and out-of-domain
errors, tune thresholds on a separate validation set, and assess calibration.
Keep test data separate from threshold tuning and model fitting.

Change the model version when changing training data, tokenization, thresholds,
priority rules, or templates, and rerun both evaluation and domain tests. Preserve
honest descriptions of the deterministic summary and template reply behavior.
