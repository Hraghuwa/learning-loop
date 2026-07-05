# Loop Iteration 24 — Exercise the real Z3-verified path in the golden gate

**Date:** 2026-07-05
**Branch:** `loop/24-logic-verified-golden` (stacked on `loop/07-arithmetic-resolve`)
**Domain focus:** ML / reasoning quality — the Z3 wiring, proven end-to-end

## What & why

The Z3 logic verifier (PR #1) was unit-tested, but the golden harness routed
every logic case through the best-effort branch — the harness's `scriptFor`
never emitted an ` ```smt``` ` block, so the verified logic path had **zero
end-to-end coverage** (classify → stages → `parseSmt` → sidecar → Z3 solve →
uniqueness re-solve → reconciliation).

Now `SMT_FOR` maps golden case ids to known-unique SMT formalizations, and the
harness scripts those cases with the fenced block:

- **L4** (series 2,6,12,20,30,? = n(n+1)): `(assert (= next (* 6 7)))` —
  verified against the **real sidecar** first: `{"status": "sat", "solution":
  "[next = 42]"}` (sat + blocked-model re-solve proves uniqueness).

Assertions tightened in both directions:

- SMT-bearing logic cases must be `verified`, the Z3 model string must
  *contain* the expected answer, and no discrepancy may be flagged.
- The domain invariant is now **exact**: `logic.verified === |SMT_FOR ∩ cases|`
  (no false claims, and the Z3 path must actually fire — a silent fall-through
  to best-effort now fails the gate). Verbal stays `verified === 0` forever.

## Verification (evidence)

- Strike-rate: arithmetic 15/15 verified · **logic 4/4 correct, 1 Z3-verified**
  · verbal 1 correct, 0 verified. Full suite: **62 passed | 1 skipped (24 files)**.
- `tsc --noEmit` clean. SMT solved via the actual `src/verify/sidecar.py`
  (local z3), not a mock — CI installs `z3-solver`, so it runs there too.

## Next

- Encode more logic cases as SMT (seating/ranking are encodable; blood
  relations are not) to grow `logic.verified`.
- Kaggle-blocked: recall@k eval, AutoGluon retrain.
