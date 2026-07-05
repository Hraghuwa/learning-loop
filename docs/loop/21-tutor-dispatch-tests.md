# Loop Iteration 21 — Characterize the /tutor hybrid dispatch

**Date:** 2026-07-05
**Branch:** `loop/21-tutor-dispatch-tests` (stacked on `loop/08-inference-quality`)
**Domain focus:** Test coverage — the tutor's answer-selection policy

## What & why

PR #8 landed the `/tutor` endpoint with tests only for its generation params.
The **dispatch policy** — the decision that determines which answer the user
sees and with what confidence — was untested:

```
top_score ≥ 0.92 AND citation has answer  → exact-match   (conf = min(0.99, score))
citations exist                            → retrieval+model (conf = 0.4 + 0.5·score)
retrieval failed / empty                   → model-only    (conf = 0.2)
```

Six characterization tests (`tests/ml_server/test_tutor_dispatch.py`), all
heavy deps stubbed so they run anywhere:

1. High-similarity + answer → exact-match with score-based confidence.
2. Confidence capped at 0.99 even at score 1.0 (nothing is certain).
3. Below threshold → model answer served *with* citations, blended confidence.
4. **High score but empty citation answer → NOT exact-match** (guards the
   `cites[0].answer` condition — an empty corpus answer must not be served).
5. Retrieval failure → model-only, confidence 0.2.
6. Everything down → still HTTP 200 with `"(no answer found)"` (never a 500
   to the UI).

## Verification (evidence)

- `pytest tests/ml_server/` → **9 passed** (6 new + 3 from #8).
- No production code changed — pure characterization; any future change to
  the dispatch thresholds now fails loudly.

## Next

- Kaggle-blocked: recall@k eval, AutoGluon retrain.
