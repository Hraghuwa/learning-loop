# Loop Iteration 15 — Self-consistency confidence calibration

**Date:** 2026-07-05
**Branch:** `loop/15-confidence-calibration` (stacked on `loop/14-exemplar-quality`)
**Domain focus:** ML / reasoning quality — honest confidence reporting

## The bug

The best-effort branch computed `confidence = round(60 + 40·agreement)`. Two
miscalibrations:

1. **n=1 reported 100.** A single sample trivially "agrees with itself"
   (agreement = 1), so an unverified one-shot answer displayed the same
   certainty as a machine-verified one. This is exactly the dishonesty the
   verifier trio exists to prevent — and the default `/api/solve` path runs
   at n=1, so *every* non-arithmetic answer was shipping with confidence 100.
2. **Unanimity at n≥2 also reported 100.** Agreement is evidence, not proof;
   best-effort should never be visually indistinguishable from verified.

## The fix (`src/pipeline/pipeline.ts`)

```
confidence = n === 1 ? 50                                  // no evidence
           : min(95, round(60 + 40·agreement))             // capped below verified
```

- n=1 → 50: the no-evidence baseline.
- n≥2 unanimity → 95, never 100 (only Python/Z3 earn 100).
- Majority cases unchanged: agreement 2/3 still → 87
  (`tests/pipeline/consistency.test.ts` untouched and passing).

## Verification (evidence)

- TDD: `tests/pipeline/calibration.test.ts` (2) — red first
  (`expected 100 to be 50`, `expected 100 to be 95`), green after.
- Full suite: **51 passed | 1 skipped (22 files)** — no regressions.
  `tsc --noEmit` clean.
- Local `next build` remains blocked by the pre-existing Tailwind v3/v4
  working-tree mismatch (`docs/loop/11-ci-gate.md`); CI is the build gate.

## Next

- Per-domain strike-rate as a CI regression gate.
- Kaggle-blocked: recall@k eval, AutoGluon retrain.
