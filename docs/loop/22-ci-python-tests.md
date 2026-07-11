# Loop Iteration 22 — Run the stubbed ml_server tests in CI

**Date:** 2026-07-05
**Branch:** `loop/22-ci-python-tests` (stacked on `loop/11-ci-gate`)
**Domain focus:** Process integrity — close the CI coverage gap

## What & why

`tests/ml_server/` (9 tests: generation params from PR #8, tutor dispatch from
PR #21) stubs torch/transformers/autogluon in `sys.modules`, so it runs in
~0.2 s with only `fastapi + httpx + pytest` installed — yet CI didn't run it.
The FastAPI serving layer (answer-selection policy, inference params) was the
one tested component with no CI enforcement.

New guarded step in `.github/workflows/ci.yml` after the vitest step:

```yaml
if [ -d tests/ml_server ]; then
  pip install fastapi httpx pytest
  python -m pytest tests/ml_server -q
else
  echo "tests/ml_server not present on this ref — skipping."
fi
```

Guarded like the lint step because the test dir lands in a separate PR (#8);
branches without it must not fail.

## Verification (evidence)

- The exact commands pass locally in a fresh-deps context: 9 passed in 0.21 s.
- CI on this branch runs the new step live (the dir is absent on this ref →
  the skip path is what executes here; the run path is exercised once #8
  merges — both branches of the guard are trivially shell).

## Next

- Kaggle-blocked: recall@k eval, AutoGluon retrain.
