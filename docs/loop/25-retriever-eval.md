# Loop Iteration 25 — Retriever recall@k evaluation harness

**Date:** 2026-07-07
**Branch:** `loop/25-retriever-eval` (base `blackboxai/repo-docs`)
**Domain focus:** ML quality — first measured retrieval numbers

## What & why

The `.st-retriever-prod/` artifact directory now contains a complete
prod-layout build (`faiss.index`, `meta.parquet`, `model/`, `stats.json`) —
currently a **2,000-row smoke sample**, not yet the full 728k Kaggle build.
That's enough to build and validate the evaluation harness now, so the exact
same script produces comparable numbers the moment the full index drops in.

`scripts/eval_retriever.py` (Mac-light: a few hundred CPU embeddings):

- **Alignment assert** — `index.ntotal == len(meta)`, and per-row **self
  recall@1 must be ≥ 0.98** or the script exits nonzero (misaligned
  index/metadata is the classic silent killer of retrieval quality).
- **`self` probe** — query with the stored text verbatim (sanity).
- **`truncated60` probe** — query with the first 60% of the text: a proxy for
  real user questions, which never match corpus phrasing exactly.
- Writes `.st-retriever-prod/eval.json` (artifact dir, gitignored); numbers
  are recorded in these notes.

## Measured (2,000-row smoke index, 200 samples, seed 0)

| probe | recall@1 | recall@3 | recall@5 |
|-------|----------|----------|----------|
| self | **1.000** | 1.000 | 1.000 |
| truncated-60% | **0.990** | 1.000 | 1.000 |

Self recall@1 = 1.0 proves the index and metadata rows are perfectly aligned;
0.99 on truncated queries says the HNSW parameters (M=32, efSearch=64) lose
essentially nothing at this scale. **Re-run after the full 728k Kaggle build
lands** — recall on a 364× larger index is the number that matters.

## Verification (evidence)

- Run output above; `eval.json` written; sanity gate exercised (exit 0).
- Script handles any index size; `--n/--k/--seed` reproducible.

## Next

- User: run the FULL Kaggle retriever build (current artifact is the 2k smoke),
  then re-run `python scripts/eval_retriever.py --n 500`.
- Then: wire top-k exemplars from the prod index into solve() and measure lift.
