# Loop Iteration 12 — Roll the `.btn` design system through the app

**Date:** 2026-07-02
**Branch:** `loop/12-btn-rollout` (stacked on `loop/10-design-system`)
**Domain focus:** Frontend beautification — consistency via the component layer

## What & why

PR #10 introduced the reusable button layer (`.btn`, `.btn-primary`,
`.btn-ghost`, `.btn-sm`) and applied it to the marketing landing/header only.
This iteration finishes the rollout: **18 inline gold-button class strings
across 14 files** replaced with the component classes, so every primary action
in the app now shares one visual definition (hover, active, disabled, focus
ring, sizing) instead of hand-copied utility strings that had drifted
(some had `hover:bg-[var(--gold-dark)]`, some didn't; some had
`disabled:opacity-50`, some didn't).

## Files converted

| File | Buttons |
|------|---------|
| `app/error.tsx`, `app/not-found.tsx` | recovery CTAs |
| `(app)/dashboard/page.tsx` | header CTA |
| `(app)/institute/page.tsx` | New Batch, Create Batch, Cancel (ghost) |
| `(auth)/login/page.tsx`, `(auth)/signup/page.tsx` | submits + login link |
| `(marketing)/forgot-password`, `reset-password`, `pricing` | submits / plan CTA |
| `components/settings/settings-form.tsx` | save |
| `components/coach/tutor-thread.tsx` | send |
| `components/billing/checkout-button.tsx` | checkout |
| `components/onboarding/onboarding-form.tsx` | submit |
| `components/practice/mock-test-runner.tsx` | 2 CTAs |
| `components/practice/question-session.tsx` | next-question CTA |

**Deliberate exceptions (kept as-is):** the hero-sized practice submit
(`font-serif text-xl py-4`, a distinct design), the extra-small
study-plan button, progress-bar meters, and tinted note boxes that use
`bg-[var(--gold)]/N` as color washes, not buttons.

Every converted button also inherits the `:focus-visible` ring and
reduced-motion behaviour from PR #10 for free.

## Verification (evidence)

- `npx eslint src` → **0 problems** · `tsc --noEmit` clean ·
  `npm run test` passes · `npm run build` ok.
- Sizing preserved: `w-full`/`flex-1`/`btn-sm` map to the originals'
  `py-3`/`py-2 px-4` paddings.

## Next

- CI is live and green on PR #11 (tsc + lint + z3/sympy tests + build).
- Blocked on user's Kaggle runs: recall@k eval, retrieval-augmented reasoning,
  AutoGluon retrain.
- Candidate next: README overhaul documenting the architecture + loop process.
