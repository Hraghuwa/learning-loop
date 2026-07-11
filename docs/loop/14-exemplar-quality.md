# Loop Iteration 14 — Retrieval-augmented exemplars carry reasoning traces

**Date:** 2026-07-05
**Branch:** `loop/14-exemplar-quality` (base `blackboxai/repo-docs`)
**Domain focus:** ML / reasoning quality (local-light; no Kaggle dependency)

## What & why

`solve()` already retrieves the top-3 similar solved traces from memory and
injects them into every stage prompt ("Analogous solved problems"). But the
exemplars were formatted as bare `Q: …\nA: …` — the **reasoning trace**
(`trace.output`, the articulation stage stored on every solve) was thrown away.

Analogous *reasoning* is what actually transfers between problems: seeing
`Speed = distance/time = 120/2 = 60` teaches the method; seeing only `A: 60
km/h` teaches nothing. This iteration upgrades the exemplar format:

```
Q: <problem>
Reasoning: <output, clipped to 400 chars + …>
A: <answer>
```

- Traces longer than 400 chars are clipped so three exemplars can't blow up
  every one of the 9 stage prompts (bounded prompt growth: ≤ ~1.2k chars).
- Empty outputs omit the `Reasoning:` line entirely (no noise).

Scoped to `src/pipeline/pipeline.ts` only — the memory layer is untouched.

## Verification (evidence)

- TDD: `tests/pipeline/exemplars.test.ts` (3) written first, 2 failed red
  (no `Reasoning:` in prompts; 5000-char trace embedded whole), green after.
  Uses a `CaptureModel` that records every prompt reaching the model, so the
  assertions are on what the LLM actually sees.
- `npm run test` → **49 passed | 1 skipped (21 files)**. `tsc --noEmit` clean.
- `npm run build` fails locally **only** due to the pre-existing uncommitted
  Tailwind v3/v4 working-tree mismatch documented in
  `docs/loop/11-ci-gate.md` (unrelated: this change is TS-only). CI builds the
  committed, consistent files and is the authoritative build gate.

## Next

- Self-consistency confidence calibration; per-domain strike-rate CI gate.
- Kaggle-blocked: recall@k eval over `.st-retriever-prod`, AutoGluon retrain.
