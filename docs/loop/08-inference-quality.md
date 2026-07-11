# Loop Iteration 08 — ML-server inference quality (anti-repetition + tutor serving)

**Date:** 2026-06-10
**Branch:** `loop/08-inference-quality`
**Domain focus:** ML serving quality (local-light; heavy compute stays on Kaggle)

## What & why

Observed failure mode: the fine-tuned FLAN-T5 repeats n-grams at inference
("the answer is the answer is…") and truncates multi-step answers at 32 tokens.
Fixed at the serving layer in `ml_server/main.py`:

- `no_repeat_ngram_size=3` on every `model.generate()` call — blocks the
  repetition loop without changing the model.
- `max_new_tokens` raised 32/48 → 128 on `/generate` and `/tutor`, so
  chain-of-thought-style answers ("…\nFinal answer: X", the format the Kaggle
  trainer now targets) aren't cut mid-solution.

This PR also lands the previously-unversioned ML-server serving work this
change builds on:

- `_load_prod_retriever()` — loads `.st-retriever-prod/` (full 728k-row corpus
  index with citation metadata in `meta.parquet`), falling back to the demo
  retriever when the Kaggle-built artifact isn't downloaded yet.
- `POST /tutor` — hybrid answering: exact-match (retrieval score ≥ 0.92) →
  retrieval+model → model-only, with citations (source, license, url) and a
  confidence blend. `/health` now reports `prod_retriever` availability.

## Verification (evidence)

- TDD: `tests/ml_server/test_generate_params.py` (3) written first and failed
  red (`'no_repeat_ngram_size' not found in {'input_ids': …, 'max_new_tokens': 48}`),
  then green after the fix. Tests stub torch/transformers so they run anywhere.
- `python -m pytest tests/ml_server/` → **3 passed**.
- `npm run test` → **62 passed | 1 skipped**. `tsc --noEmit` clean. `npm run build` ok.

## Kaggle status (free-compute track)

- Corpus uploaded as Kaggle Dataset
  `harshraghuwanshi72/learning-loop-corpus` (~1.05 GB, 7 files) ✓
- Next user action: run `scripts/cloud/build_retriever_kaggle.py` and
  `scripts/cloud/train_flan_t5_kaggle.py` in GPU notebooks, then download
  artifacts into `.st-retriever-prod/` and `.flan-t5-answer/` — the server
  picks both up without code changes.

## Next (local-light)

- Arithmetic re-solve loop on LLM/verifier discrepancy (design spec §6 step 7).
- Frontend React-Compiler compliance / beautification.
- After Kaggle artifacts land: retrieval recall@k eval + retrieval-augmented
  reasoning lift measurement.
