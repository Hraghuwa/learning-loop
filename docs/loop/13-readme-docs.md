# Loop Iteration 13 — README refresh: verifiers, CI, Kaggle, loop log

**Date:** 2026-07-05
**Branch:** `loop/13-readme-docs` (base `blackboxai/repo-docs`)
**Domain focus:** GitHub documentation ("document everything on github")

## What & why

The README (383 lines, from the repo-docs phase) predated the loop's work and
had gone stale in three ways:

1. **Wrong claim:** "Logic verifier exists but is intentionally not fully wired"
   — it *is* wired (PR #1), and verbal entailment too (PR #6).
2. **Missing systems:** no mention of CI (PR #11), the Kaggle free-compute
   workflow (PR #5), or the verifier honesty invariant.
3. **No changelog:** the 12 loop iterations existed only in `docs/loop/` with no
   index or narrative from the README.

## Changes (README.md only)

- **CI badge** at the top (links to the Actions workflow).
- **§4 Verification** rewritten as the **verifier-trio table** (arithmetic =
  Python exec, logic = Z3 + uniqueness re-solve, verbal = entailment-as-
  confidence) with the honesty invariant spelled out: only Python/Z3 can
  produce `verified`; the accuracy harness enforces `verified === 0` for
  non-arithmetic. Notes the iteration-07 arithmetic re-solve.
- **New §16 Continuous integration** — the gate table (tsc, conditional lint,
  vitest with z3/sympy installed, build) and what deliberately isn't in CI.
- **New §17 Free GPU compute (Kaggle)** — the corpus dataset, both cloud
  scripts, and the download-into-`.st-retriever-prod`/`.flan-t5-answer`
  handshake with `ml_server`. Modal noted as optional/paid.
- **New §18 The self-improvement loop** — iteration table 01→13 linking
  `docs/loop/`, plus the loop conventions (TDD, full gate, scoped commits,
  no paid compute).
- License section renumbered 16 → 19.

## Verification (evidence)

- Docs-only change; no code paths touched. Section numbering checked
  (`grep '^## '` → 1–19 in order, internal reference updated).
- Facts cross-checked against the shipped PRs (#1–#12) and
  `.github/workflows/ci.yml` / `scripts/cloud/*` contents.

## Next

- Blocked on user's Kaggle runs: recall@k eval, retrieval-augmented reasoning,
  AutoGluon retrain.
- Candidate next: self-consistency confidence calibration; per-domain
  strike-rate as a CI regression gate.
