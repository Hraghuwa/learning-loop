# Loop Iteration 19 — Complete the Tailwind v4 → v3 migration

**Date:** 2026-07-05
**Branch:** `loop/19-tailwind-v3` (base `blackboxai/repo-docs`)
**Domain focus:** Process integrity — "make sure there is no process broken"

## The broken process

`docs/loop/11-ci-gate.md` documented a **half-applied, uncommitted Tailwind
v4→v3 migration**: `package.json` downgraded to `tailwindcss ^3.4.19`
(+ `postcss`/`autoprefixer`, dropping `@tailwindcss/postcss`),
`postcss.config.mjs` switched to the v3 plugin form, a v3 `tailwind.config.ts`
added — but `globals.css` still used the v4 `@import "tailwindcss"`. Installed
`node_modules` were v3, so **every local `next build` failed** with
`Can't resolve 'tailwindcss'`.

## The fix — commit the migration coherently

This branch lands all five pieces together (the diffs were verified to contain
*only* Tailwind-related changes before committing):

- `package.json` / `package-lock.json` — tailwindcss `^3.4.19`, `postcss`,
  `autoprefixer`; `@tailwindcss/postcss` removed
- `postcss.config.mjs` — `{ tailwindcss, autoprefixer }`
- `tailwind.config.ts` — v3 content globs (was untracked)
- `src/app/globals.css` — `@import "tailwindcss"` → the three v3 `@tailwind`
  directives

The `loop/09/10/12` frontend branches already use v3 directives in their
`globals.css`, so the final merged state is consistently v3. **Merge this
before or together with those branches**; CI (npm ci from the lockfile) gets
v3 either way once this lands.

## Verification (evidence)

- **`npm run build` passes locally for the first time this session.**
- `npm run test` → 46 passed | 1 skipped · `tsc --noEmit` clean.

## Next

- Kaggle-blocked: recall@k eval, AutoGluon retrain.
