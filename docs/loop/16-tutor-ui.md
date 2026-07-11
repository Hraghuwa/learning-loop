# Loop Iteration 16 — Land the tutor UI (was untracked)

**Date:** 2026-07-05
**Branch:** `loop/16-tutor-ui` (base `blackboxai/repo-docs`)
**Domain focus:** Frontend + serving integration; process integrity (unversioned work)

## What & why

The chat-style tutor UI (`src/app/tutor/page.tsx`, 317 lines) — the frontend
for the `/tutor` hybrid endpoint that landed in PR #8 — was sitting
**untracked** in the working tree. Unversioned work can be lost to a single
`git clean`; landing it closes the loop on the tutor feature end-to-end:

- Chat interface with example prompts, pending/error states, auto-scroll.
- Per-answer **method badge** (`exact-match` / `retrieval+model` /
  `model-only`), confidence bar, and the raw model output when it differs
  from the served answer (transparency).
- **Citations panel**: similarity score, subDomain, source, license, and
  outbound URL for every retrieved passage — the licensed-corpus grounding
  made visible.
- **Backend health pill**: online/offline plus which corpus is loaded
  (full ~550K prod index vs. 10.5K demo) via `GET /api/ml/predict`.

Plus the one-line enabler in `src/app/api/ml/predict/route.ts`: `"tutor"`
added to the zod `mode` enum so the proxy forwards to the FastAPI `/tutor`
endpoint. UI and enabler ship together — they are one feature.

## Verification (evidence)

- `tsc --noEmit` clean · `npx eslint` on both files → 0 problems ·
  `npm run test` → 46 passed | 1 skipped.
- The endpoint side (`ml_server` `/tutor`, prod-retriever fallback) was
  already tested in PR #8 (`tests/ml_server/test_generate_params.py` covers
  its generate params; hybrid dispatch logic reviewed there).
- Local `next build` remains blocked by the pre-existing Tailwind v3/v4
  working-tree mismatch (`docs/loop/11-ci-gate.md`) — unrelated to this change.

## Next

- Per-domain strike-rate / dataset-shrinkage guard in the accuracy harness.
- Kaggle-blocked: recall@k eval (the health pill will flip to "full ~550K"
  automatically once the user drops in `.st-retriever-prod/`).
