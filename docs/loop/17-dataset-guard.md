# Loop Iteration 17 — Golden-dataset shrinkage guard

**Date:** 2026-07-05
**Branch:** `loop/17-dataset-guard` (base `blackboxai/repo-docs`)
**Domain focus:** Process integrity — the gate must not weaken silently

## What & why

The accuracy harness asserts every case in `datasets/cat-pyq.jsonl`
individually — which means **deleting rows silently weakens the gate**: a
19-case dataset passes just as green as a 20-case one. Nothing pinned the
dataset's size or composition.

New first test in `tests/golden/accuracy.test.ts` pins the per-domain floor
(arithmetic ≥ 15, logic ≥ 4, verbal ≥ 1, total ≥ 20 — the current census).
Growing the dataset stays free; shrinking it now fails the suite and must be
a deliberate, reviewed edit of the floor.

Also carries the 30s timeout for the python-sidecar harness (same fix as on
`loop/11-ci-gate`; ~20 cold `python3` subprocess spawns exceed vitest's 5s
default on shared CI runners).

## Verification (evidence)

- `vitest run tests/golden/accuracy.test.ts` → 2 passed | 1 skipped (new
  guard green against the real dataset census: 15/4/1).
- `tsc --noEmit` clean.

## Next

- Kaggle-blocked: recall@k eval, AutoGluon retrain.
- Candidate: logic-domain golden cases expansion (only 4 today).
