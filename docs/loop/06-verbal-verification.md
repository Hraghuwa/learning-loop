# Loop Iteration 06 — Wire verbal entailment verification into the pipeline

**Date:** 2026-06-09
**Branch:** `loop/06-verbal-verification` (stacked on `loop/01-logic-verification`)
**Domain focus:** ML / reasoning quality — verifier coverage (local-light, no heavy compute)

## What & why

`verifyVerbal` (`src/verify/verbal.ts`) — an LLM entailment check — existed but was
never called by `solve()`. Verbal-domain answers relied solely on self-consistency
voting, whose confidence (`60 + 40·agreement`) is meaningless at `n=1` (a single
sample trivially "agrees" → confidence 100). This wires in a real signal.

Completes the verifier trio: **arithmetic** (Python exec) ✓, **logic** (Z3) ✓,
**verbal** (entailment) ✓.

## The honesty boundary

Verbal entailment is an LLM *judgement*, not a formal proof. So it **only modulates
confidence** — verbal stays `best-effort` and is **never** marked `verified`. Only
executed Python and Z3 produce `verified`. This preserves the accuracy harness's
invariant (non-arithmetic `verified === 0`).

## Change (`src/pipeline/pipeline.ts`)

After the dispatch picks a winner, for `domain === 'verbal'`:
`verifyVerbal(answer, problem, model)` →
- `entail`   → confidence `min(95, 50 + round(conf·0.45))`
- `contradict` → confidence `max(5, round(conf·0.2))` + a `discrepancy` note
- `neutral`  → confidence `35`

## Verification (evidence)

- TDD: `tests/pipeline/verbal-verify.test.ts` (3) — entail raises & stays best-effort,
  contradict drops + flags discrepancy, neutral baseline. Written before the impl.
- Harness updated: `tests/golden/accuracy.test.ts` `scriptFor` appends a neutral
  entailment response for verbal cases (the pipeline now makes one extra model call);
  verbal stays best-effort, `verified === 0` invariant holds.
- `tests/pipeline/consistency.test.ts` retargeted from `verbal` → `di` (it tests the
  generic self-consistency confidence formula, which verbal no longer uses).
- `npm run test` → **57 passed | 1 skipped**. `tsc --noEmit` clean. `npm run build` ok.
- Lint: the gate can't run on this branch — its fix lives in PR #3 (ESLint flat config),
  not yet in this branch's ancestry. Not a regression.

## Next (local-light)

- Arithmetic re-solve loop on LLM/verifier discrepancy (design spec §6 step 7).
- `no_repeat_ngram_size` at inference in `ml_server` (fixes observed repetition).
- Frontend React-Compiler compliance / beautification.
