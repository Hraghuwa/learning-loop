# Loop Iteration 26 — Rate-limit + input cap on /api/solve

**Date:** 2026-07-07
**Branch:** `loop/26-solve-rate-limit` (base `blackboxai/repo-docs`)
**Domain focus:** Backend hardening — the most expensive endpoint was unguarded

## What & why

`POST /api/solve` fans out to ~10 model completions plus Python verifier
subprocesses per call — and it had **no rate limit and no input length cap**
(the ML proxy route zod-caps at 2000 chars; this route accepted a 10 MB
`problem` string straight into every stage prompt).

- **`src/lib/rate-limit.ts`** — `FixedWindowLimiter`: dependency-free
  fixed-window counter with injectable clock, per-key windows, `Retry-After`
  computation, and opportunistic stale-key sweeping (map size stays bounded
  under many distinct keys). In-memory is the right scope: the resource being
  protected (this instance's CPU + model budget) is per-instance.
- **Route:** 10 req/min per client (first `x-forwarded-for` hop, `local`
  fallback) → 429 + `Retry-After`; `problem` capped at 4000 chars → 400.
  Both guards run **before** any model call.

## Verification (evidence)

- TDD: `tests/lib/rate-limit.test.ts` (4 — limit/refuse+retryAfter, window
  reset, key independence, stale eviction with 5000 keys) and two new route
  tests (oversize → 400 before any model call; 11th request → 429 with
  positive `Retry-After`).
- Full suite: **52 passed | 1 skipped (21 files)** · `tsc --noEmit` clean.

## Next

- Blocked on user: full Kaggle runs (artifacts on disk are the 2k/300-row
  smokes), PR merges per MERGE-ORDER.md.
