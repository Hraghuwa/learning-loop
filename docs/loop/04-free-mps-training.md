# Loop Iteration 04 — Free generation training (local MPS + free Kaggle GPU)

**Date:** 2026-06-08
**Branch:** `loop/04-free-mps-training`
**Domain focus:** ML training (Phase 2) — **zero-cost path**

## What & why

Directive: *"I want everything free."* Modal (Iteration 02) uses free *credits* then
charges — not truly free. This makes generation training **$0 by default** using the
hardware already on hand, with a free GPU scale-up that needs no payment.

## The free strategy (priority order)

1. **Local, on your Mac's GPU (Metal / MPS)** — `scripts/train_flan_t5.py`, rewritten
   from the old CPU-only/2K-row toy into a real trainer: auto-selects MPS, learns
   chain-of-thought `solution` targets (problem → solution + `Final answer:`) on a
   **curated subset** (solution-rich rows first) of the full 483K-pair corpus.
   No account, no credits.
2. **Free GPU scale-up on Kaggle** — `scripts/cloud/train_flan_t5_kaggle.py`. Kaggle
   Notebooks give free **T4/P100, 30 hrs/week**, far more stable than Colab. For
   `flan-t5-base/large` or the full corpus, still $0 (free account + phone verify).
3. **Modal** (Iteration 02) is relabeled **optional, paid** — only if someone wants
   serverless convenience and is fine paying.

Everything else in the loop (retriever, classifiers, reasoning, verifiers, eval) is
already 100% free/local.

## Verification (evidence)

Real smoke on this machine:
```
Device: mps | torch 2.9.1
Available pairs: 483713
Training on 300 pairs … Done in 2.0 min
eval_loss 1.81 ; saved → .flan-t5-answer/train_metrics.json
```
- Confirms the trainer runs **on the Apple GPU (mps), free**, end-to-end (load → train
  → eval → save → sample-generate).
- `python -m py_compile scripts/cloud/train_flan_t5_kaggle.py` → OK.
- 300-row/1-epoch sample outputs are (expectedly) repetitive — that validates the
  *pipeline*, not quality. A proper run (`--rows 30000 --epochs 2`) produces the real
  model. **Run it after the retriever build finishes** to avoid GPU contention.

## Notes / follow-ups

- The smoke wrote to the real `.flan-t5-answer/` (the path `ml_server` loads),
  replacing the previous 2K-row demo model. Both are throwaway; a real run regenerates
  it. Future smokes should target a temp dir.
- Repetitive generation suggests adding `no_repeat_ngram_size` / `num_beams` at
  **inference** in `ml_server` — queued as a small generation-quality fix.

## Next

- Real free local run (`--rows 30000 --epochs 2`) once the retriever build completes.
- Then: wire `.st-retriever-prod` into `ml_server` + recall eval; AutoGluon retrain;
  retrieval-augmented reasoning.
