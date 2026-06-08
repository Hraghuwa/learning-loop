# Loop Iteration 02 — Cloud GPU training harness for the generation model

**Date:** 2026-06-08
**Branch:** `loop/02-cloud-gpu-training`
**Domain focus:** ML training (Phase 2)

## What & why

The repo's `scripts/train_flan_t5.py` is a toy: CPU-only, FLAN-T5-**small** (~80M),
2 000 rows, 1 epoch, problem→**answer**. On a 16 GB Mac a real fine-tune over the
full ~480K problem→**solution** corpus is impractical (hours–days, likely OOM). So
the generation fine-tune moves to **cloud GPU** while the rest of the ML track
(retriever, classifiers, retrieval-augmented reasoning, eval) stays local.

## Deliverable

`scripts/cloud/train_flan_t5_modal.py` — a [Modal](https://modal.com) harness that:

- Uploads the math + reasoning + combined-qa corpora to a Modal Volume.
- Fine-tunes a real model (default `flan-t5-base`, configurable up to `-large`) on
  GPU (A10G/A100), learning **chain-of-thought solutions** (`solution` + pinned
  `Final answer:`), not just the bare answer.
- Writes a small, git-committable `train_metrics.json` sidecar (eval loss, rows,
  runtime) next to the model.
- Leaves the model in `learning-loop-models:/flan-t5-answer`, pullable into the
  exact path `ml_server` already loads (`.flan-t5-answer/`).

## How to run (operator steps)

```bash
pip install modal && modal token new          # one-time
modal run scripts/cloud/train_flan_t5_modal.py                       # base, 200K rows, 2 epochs
modal run scripts/cloud/train_flan_t5_modal.py --max-rows 4000 --epochs 1   # cheap smoke
modal volume get learning-loop-models /flan-t5-answer ./.flan-t5-answer      # pull back
```

**Cost:** A10G ≈ $1.10/hr, A100 ≈ $3.70/hr → a base run is ~$3–10. Smoke tests are
near-free.

## Verification (evidence)

- `python -m py_compile scripts/cloud/train_flan_t5_modal.py` → OK (syntax clean).
- Field mapping verified against real corpus rows (`problem`/`answer`/`solution`
  present in math & reasoning; `solution == "None"` rows fall back to answer).
- Full execution requires a Modal account (operator-run, spends money) — out of
  scope for the loop's local CI; the harness is delivered ready-to-run.

## Why not Vercel

Vercel is serverless **app** compute (300 s function ceiling), not multi-hour GPU
training. Right tool = a GPU cloud (Modal / RunPod / Lambda). Modal chosen for the
least-friction Python wrapping of the existing training code.

## Next

- Local, in-flight: production retriever build over the full 728K-row corpus
  (Iteration 03) → wire into ml_server + retrieval-recall eval.
- Then: AutoGluon classifier retrain + eval, retrieval-augmented reasoning lift,
  ESLint flat-config (lint gate), CI eval-regression gates.
