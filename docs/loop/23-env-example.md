# Loop Iteration 23 — `.env.example` was never in git; land it complete

**Date:** 2026-07-05
**Branch:** `loop/23-env-example` (base `blackboxai/repo-docs`)
**Domain focus:** Process integrity — onboarding was broken for fresh clones

## The broken process

README §10 says `cp .env.example .env.local` — but `.env.example` **was never
tracked** (`.gitignore`'s `.env*` swallowed it), so the file existed only on
the original author's disk. Every fresh clone failed at setup step B.

The local copy was also stale: five env vars read by the code were missing
(`ML_BACKEND_URL`, `LEARNING_LOOP_AI_PROVIDER`, `OLLAMA_URL`, `OLLAMA_MODEL`,
`RAZORPAY_WEBHOOK_SECRET`), and it listed `NEXT_PUBLIC_APP_URL`, which nothing
reads.

## The fix

- `.gitignore`: `!.env.example` negation after `.env*` (real env files stay
  ignored).
- `.env.example` rewritten from a census of every `process.env.*` in
  `src/`+`scripts/` (13 vars), grouped with comments, with safe defaults
  (`LEARNING_LOOP_AI_PROVIDER=local` needs no keys;
  `ML_BACKEND_URL=http://localhost:8000`; Ollama defaults). The unread
  `NEXT_PUBLIC_APP_URL` dropped.

## Verification (evidence)

- `git check-ignore .env.example` → no longer ignored.
- Var census: `grep -rhoE 'process\.env\.[A-Z_]+' src scripts | sort -u`
  → all 13 present in the file, nothing extra.
- No secrets committed — placeholder/default values only.

## Next

- Kaggle-blocked: recall@k eval, AutoGluon retrain.
