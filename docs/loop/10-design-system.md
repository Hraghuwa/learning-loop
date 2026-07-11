# Loop Iteration 10 — Design-system polish + accessibility

**Date:** 2026-06-10
**Branch:** `loop/10-design-system` (stacked on `loop/09-frontend-compiler`)
**Domain focus:** Frontend beautification — objective, verifiable polish

## What & why

"Beautify the frontend" — done as *objective* improvements (accessibility,
consistency, reduced duplication), not subjective taste churn. The app already
has a coherent editorial "paper" aesthetic; this hardens the design system
underneath it.

## Changes (`src/app/globals.css`)

Additive, low-risk, all driven by existing CSS custom properties:

1. **Elevation tokens** — `--shadow-sm/md/lg` and `--ring`, a single source of
   truth for depth and focus styling.
2. **Accessibility:**
   - `:focus-visible` gold ring on every interactive element (keyboard nav),
     scoped so pointer users don't see it.
   - `prefers-reduced-motion: reduce` neutralises all transitions/animations.
   - `scroll-behavior: smooth` only under `prefers-reduced-motion: no-preference`.
3. **Polish:** branded `::selection` (gold), font antialiasing + `optimizeLegibility`.
4. **`.paper-card`** now carries `--shadow-sm`; new opt-in `.paper-card-hover`
   adds a subtle lift + gold border on hover for clickable cards.
5. **Reusable button system** (`@layer components`): `.btn`, `.btn-primary`,
   `.btn-ghost`, `.btn-sm`. Replaces repeated inline class strings and gives
   consistent active/disabled/hover states everywhere.

## Applied (`(marketing)/page.tsx`, `(marketing)/layout.tsx`)

- Landing hero + final CTA buttons → `.btn .btn-primary` / `.btn .btn-ghost`
  (removed 3 duplicated inline class strings).
- Header nav CTAs → `.btn .btn-primary .btn-sm`.
- Loop "Step" cards and "Feature" cards → `.paper-card-hover`.

## Verification (evidence)

- `npx eslint src` → **0 problems** (against PR #3 flat config).
- `tsc --noEmit` clean · `npm run test` → **62 passed | 1 skipped** ·
  `npm run build` ok.
- Changes are additive CSS + class swaps that preserve existing layout
  (same padding/sizing via `.btn` / `.btn-sm`); no structural markup changes.

## Next (local-light)

- Roll the `.btn` system through the remaining inline gold-button sites
  (settings, onboarding, pricing, tutor, mock-runner) — ~10 files.
- CI verification workflow (GitHub Actions) running the full gate on every push.
