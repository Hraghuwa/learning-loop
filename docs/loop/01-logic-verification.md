# Loop Iteration 01 — Wire logic verification into the reasoning pipeline

**Date:** 2026-06-08
**Branch:** `loop/01-logic-verification`
**Domain focus:** ML / reasoning quality

## What & why

`solve()` only machine-verified the **arithmetic** domain. The Z3-backed logic
verifier (`verifyLogic` → `src/verify/sidecar.py`) existed and was unit-tested but
was never called by the pipeline, so **logic** problems were correct yet always
`best-effort` (0 verified). This iteration gives logic the same machine-verified
treatment arithmetic has — without weakening the system's "never falsely verified"
honesty invariant.

## Changes

| File | Change |
|------|--------|
| `src/pipeline/stages.ts` | New `parseSmt()` — extracts a fenced ` ```smt ` SMT-LIB block (mirrors `parseExecute`). |
| `src/pipeline/scratchpad.ts` | New `smt?: string` field on `Scratchpad`. |
| `src/pipeline/pipeline.ts` | Capture SMT from any stage; new `logic` branch calls `verifyLogic` and sets `verified` **only** on a unique model. |
| `src/verify/sidecar.py` | `run_logic` now checks **uniqueness**: after a `sat` model is found, it re-solves forbidding that model — if another exists it returns `multiple`, else `sat`. |

## The trustworthiness point

SMT `sat` means "≥1 model exists", **not** "this answer is forced". Trusting bare
`sat` as `verified` would be a false guarantee. So the sidecar now distinguishes:

- `sat` — exactly one satisfying model → **verified** (confidence 100)
- `multiple` — more than one model → **best-effort** (confidence 40)
- `unsat` / `error` — **best-effort** (confidence 25), reason recorded in `discrepancy`

## Verification (evidence)

- New tests (TDD, written before implementation):
  - `tests/pipeline/smt.test.ts` — `parseSmt` extraction (2)
  - `tests/pipeline/logic-verify.test.ts` — `solve()` reactions to each status, verifier-not-called-without-SMT (4)
  - `tests/verify/logic.test.ts` — real-Z3 `multiple` and unique-`sat` (added 2)
- `npm run test` → **54 passed | 1 skipped** (was 46 | 1).
- Accuracy harness invariant preserved: logic `verified` still **0** (its fixtures emit no SMT), and non-arithmetic is never falsely verified.
- `npx tsc --noEmit` → clean. `npm run build` → success.

## Discovered, deferred to next iteration

- **`npm run lint` is broken project-wide**: ESLint v9 requires a flat
  `eslint.config.js`, but the repo still ships `.eslintrc.json`. Pre-existing,
  unrelated to this change. Next iteration: migrate to flat config so the loop's
  lint gate works.

## Next in the backlog

1. Fix ESLint v9 flat-config (unblock the lint gate) — promoted ahead of queue.
2. Wire verbal entailment verification (`verifyVerbal`).
3. Arithmetic re-solve loop on discrepancy.
