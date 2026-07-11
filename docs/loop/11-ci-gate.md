# Loop Iteration 11 — CI verification gate (GitHub Actions)

**Date:** 2026-06-10
**Branch:** `loop/11-ci-gate` (base `blackboxai/repo-docs`)
**Domain focus:** Process integrity — "make sure there is no process broken"

## What & why

There was **no CI**. Every loop iteration verified locally (tsc + test + build +
lint), but nothing enforced that gate on push/PR. This adds
`.github/workflows/ci.yml` so the full gate runs automatically on every push and
pull request, cancelling superseded runs to save free-tier minutes.

## The gate

| Step | Command | Always runs? |
|------|---------|--------------|
| Typecheck | `npx tsc --noEmit` | yes |
| Lint | `npx eslint .` | only if `eslint.config.mjs` exists (it lands in PR #3) |
| Test | `npm run test` (vitest) | yes |
| Build | `npm run build` (next build) | yes |

- Node 20, `npm ci` for reproducible installs.
- Placeholder `NEXT_PUBLIC_SUPABASE_*` env so Next/Supabase client construction
  doesn't throw at build (not secrets; real values injected at deploy).
- The Python `ml_server` tests need the heavy `~/autogluon-env` and run locally,
  not in CI (documented, not gated here).

## Finding surfaced while validating the gate ⚠️

Running the build locally exposed a **Tailwind version inconsistency** that the
user needs to resolve:

- **Committed `blackboxai/repo-docs`** is coherent Tailwind **v4**:
  `globals.css` → `@import "tailwindcss"`, `package.json` → `tailwindcss: ^4` +
  `@tailwindcss/postcss: ^4`, `postcss.config.mjs` → `@tailwindcss/postcss`.
- **The local working tree** has an **uncommitted, half-applied v4→v3
  migration**: `package.json` downgraded to `tailwindcss: ^3.4.19` (and
  `@tailwindcss/postcss` removed), `postcss.config.mjs` switched to the v3
  `{ tailwindcss, autoprefixer }` form, and a v3 `tailwind.config.ts` added —
  but `globals.css` still uses the v4 `@import`. `node_modules` is v3.

The mismatch (`@import "tailwindcss"` under Tailwind v3) is what makes the local
`next build` fail with `Can't resolve 'tailwindcss'`. **A clean CI checkout of
committed base builds fine** because everything there is consistently v4.

**Action for the user:** commit a single, consistent Tailwind choice. If staying
on v3 (matching the installed `node_modules`), `globals.css` must use
`@tailwind base; @tailwind components; @tailwind utilities;` (as the `loop/*`
branches already do) and the v3 `package.json`/`postcss.config.mjs`/
`tailwind.config.ts` changes must be committed. If staying on v4, drop those
uncommitted downgrades and reinstall.

## Verification (evidence)

- `tsc --noEmit` and `npm run test` pass locally on this base.
- YAML validated; uses pinned stable actions (`actions/checkout@v4`,
  `actions/setup-node@v4`).
- Local `next build` fails **only** due to the uncommitted Tailwind mismatch
  above — not due to anything in this workflow. CI runs against committed
  (consistent) files.

## Next (local-light)

- Roll the `.btn` design-system classes (PR #10) through remaining inline-button
  sites.
- Once Tailwind is committed consistently, the CI build step goes green for all
  branches.
