# Loop Iteration 05 — Move all heavy ML compute to free Kaggle GPU

**Date:** 2026-06-08
**Branch:** `loop/05-kaggle-compute` (stacked on `loop/04-free-mps-training`)
**Domain focus:** ML training/infra — **free, off the local machine**

## What & why

Directive: *"I don't want to make my Mac slow / burden it — use Kaggle."* So heavy
compute (retriever embedding, model fine-tuning) moves to **Kaggle's free GPU**
(T4/P100, 30 hrs/week). The local Mac stays idle and responsive; only light dev
work (npm test/lint/build) runs locally.

Bonus: a free Kaggle T4/P100 embeds the 728K-passage corpus in **minutes**, versus
~1.5 hrs on the laptop CPU. The in-progress local retriever build was **stopped** to
free the machine.

## Deliverables

- `scripts/cloud/build_retriever_kaggle.py` (new) — production retriever build on
  Kaggle GPU; outputs `faiss.index` + `meta.parquet` + `model/` with citation
  metadata, identical layout to the local builder.
- `scripts/cloud/train_flan_t5_kaggle.py` (from Iteration 04) — generation fine-tune
  on Kaggle GPU.
- README updated: **Kaggle is the recommended path**; local MPS and Modal are
  explicitly *optional*.

## End-to-end Kaggle workflow (free)

1. **One-time:** create a free Kaggle account (verify phone → unlocks GPU).
2. **Upload the corpus once** as a Kaggle Dataset named `learning-loop-corpus`:
   `datasets/math-corpus.jsonl`, `reasoning-corpus.jsonl`, `longform-corpus.jsonl`,
   `combined-qa.jsonl`. Reused by both the retriever and training notebooks.
3. **Retriever notebook:** New Notebook → Add Data → `learning-loop-corpus` →
   Accelerator: GPU → Internet: ON. First cell:
   `!pip -q install faiss-cpu sentence-transformers` → paste
   `scripts/cloud/build_retriever_kaggle.py` → Run. Download
   `/kaggle/working/st-retriever-prod` → unzip into `.st-retriever-prod/`.
4. **Training notebook:** same dataset, GPU on → paste
   `scripts/cloud/train_flan_t5_kaggle.py` → Run. Download
   `/kaggle/working/flan-t5-answer` → unzip into `.flan-t5-answer/`.
5. Point `ml_server` at the downloaded artifacts (already the default paths).

## Verification (evidence)

- `python -m py_compile scripts/cloud/build_retriever_kaggle.py` → OK.
- Field mapping / output layout mirror the verified local
  `scripts/build_production_retriever.py` (which produced a valid index in the
  earlier smoke), so the Kaggle port is faithful.
- Full execution is operator-run on Kaggle (free account) — not part of local CI.
  No local heavy compute is invoked by this iteration.

## Status change

- Local retriever build: **stopped** (freed the Mac). `.st-retriever-prod/` currently
  holds only a stale 2K-row smoke index; the Kaggle run produces the real one.

## Next (all free, Kaggle/local-light)

- After you run the Kaggle retriever: wire `.st-retriever-prod` into `ml_server`
  retrieve/tutor + a recall@k eval (light, local).
- Retrieval-augmented reasoning lift; AutoGluon classifier retrain (also Kaggle);
  `no_repeat_ngram_size` at inference to fix repetition.
