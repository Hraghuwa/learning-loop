# Loop Iteration 07 — Arithmetic re-solve on LLM/verifier discrepancy

**Date:** 2026-06-10
**Branch:** `loop/07-arithmetic-resolve` (stacked on `loop/06-verbal-verification`)
**Domain focus:** ML / reasoning quality — closes the v1 deferral in design spec §6 step 7 (local-light, no heavy compute)

## What & why

Until now, when the LLM's prose answer disagreed with its own executed Python
(e.g. reasoning said "41" but `print(...)` produced "42"), the pipeline trusted
the execution and surfaced a `discrepancy` note — but never gave the model a
chance to reconcile. The design spec called for ONE re-solve before trusting
the verifier; v1 deferred it. This iteration implements it.

## Behavior

On an arithmetic LLM/verifier disagreement, `solve()` issues exactly one extra
model call showing **both** conflicting values and asking for a fresh
derivation + fresh Python. The new code is executed and reconciled:

| Re-solve outcome | Action | Confidence |
|---|---|---|
| reproduces the verified value | trust it fully; clear discrepancy; set `resolution` | 100 |
| agrees with the original prose answer | first code was the bug; adopt new value; set `resolution` | 85 |
| no usable code / exec error / third value | keep first value; keep discrepancy | 90 |

## The honesty boundary

The verified value **always** comes from executed Python — the re-solve only
decides *which* execution to trust and how confident to be. `verifyState`
stays `verified` in all three outcomes because every candidate value was
machine-executed. New `resolution?: string` field on the Scratchpad records
the audit trail; the re-solve transcript is stored as `stages['resolve']`.

## Verification (evidence)

- TDD: `tests/pipeline/resolve.test.ts` (5) written first — confirmed,
  corrected, unresolved (no code), unresolved (third value), and a
  no-discrepancy guard proving zero extra model calls (FakeModel throws on
  any unscripted call).
- `tests/pipeline/pipeline.test.ts` discrepancy case updated: it now scripts
  the one re-solve response (behavior change is intentional and covered).
- Accuracy harness unaffected: its arithmetic scripts always agree with the
  executed value, so no re-solve fires; `verified === total` invariant holds.
- `npm run test` → **62 passed | 1 skipped**. `tsc --noEmit` clean.
  `npm run build` ok.

## Next (local-light)

- `no_repeat_ngram_size` at inference in `ml_server` (fixes observed repetition).
- Frontend React-Compiler compliance / beautification.
- BLOCKED on user's Kaggle runs: wire `.st-retriever-prod` into ml_server +
  recall@k eval (corpus upload to Kaggle started 2026-06-10).
