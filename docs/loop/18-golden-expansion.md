# Loop Iteration 18 — Golden dataset expansion (logic 4→8, verbal 1→4)

**Date:** 2026-07-05
**Branch:** `loop/18-golden-expansion` (base `blackboxai/repo-docs`)
**Domain focus:** Eval breadth — the thin domains of the golden gate

## What & why

The golden dataset was arithmetic-heavy (15/4/1). Logic and verbal — exactly
the domains covered by the newer verifiers (Z3, entailment) — had the least
gate coverage. Added 7 authored CAT-style cases with genuinely correct
answers (they also feed the API-key-gated real-model scorecard, so answers
must be true, not just self-consistent):

| id | subDomain | answer |
|----|-----------|--------|
| L5 | seating-arrangement | D (A=1, C=3, B=4; E≠2 → E=5, so D=2) |
| L6 | syllogism | no (some-flowers-fade ⊬ some-roses-fade) |
| L7 | number-series | 47 (Fibonacci-style sum) |
| L8 | ranking | 32 (7 + 26 − 1) |
| V2 | antonyms | evasive |
| V3 | analogy | school |
| V4 | classification | potato |

Census is now **arithmetic 15 / logic 8 / verbal 4 (total 27)**; the
iteration-17 shrinkage floor is raised to match (27 / 15 / 8 / 4).

## Verification (evidence)

- JSON validated; ids unique (scripted check).
- Full harness over all 27 cases: arithmetic 100% machine-verified,
  logic/verbal correct and never falsely verified. `tsc --noEmit` clean.
- Composes with PR #6's harness change (entailment response is appended
  per-verbal-case conditionally).

## Next

- Kaggle-blocked: recall@k eval, AutoGluon retrain.
