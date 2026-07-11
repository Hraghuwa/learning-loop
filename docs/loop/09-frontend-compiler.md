# Loop Iteration 09 — Frontend React-Compiler compliance

**Date:** 2026-06-10
**Branch:** `loop/09-frontend-compiler`
**Domain focus:** Frontend quality — zero React-Compiler / lint warnings

## What & why

The React Compiler lint rules (shipped via `eslint-config-next@16`'s
`react-hooks/*` set) flagged **11 warnings** across 8 files. These are real
correctness/perf smells: components recreated each render (state resets),
synchronous `setState` inside effects (cascading renders), an impure clock read
during render, and a dead unused-var / misplaced eslint-disable directives.
Cleared all 11 → **0 warnings**.

## The 11 warnings and how each was fixed

| File | Rule | Fix |
|------|------|-----|
| `layout/sidebar.tsx` ×2 | `static-components` | `NavContent` was a component declared during render and used as `<NavContent/>` (resets state every render). Converted to a plain JSX element `navContent` rendered as `{navContent}`. |
| `layout/sidebar.tsx` | `set-state-in-effect` | Removed the `useEffect` that called `setMobileOpen(false)` on `pathname` change; the drawer now closes via `onClick` on each nav link (event, not effect). |
| `hooks/use-speech-reasoning.ts` | `set-state-in-effect` | `supported` is now derived once via a lazy `useState` initializer from the platform API, instead of `setSupported(...)` synchronously in the effect. |
| `dashboard/upgrade-banner.tsx` | `set-state-in-effect` | Initial `show` derived from the URL param via lazy `useState`; the effect now only performs the external side-effect (stripping the query param). |
| `(marketing)/reset-password/page.tsx` | `set-state-in-effect` | `ready` starts `true` (optimistic — Supabase rejects an invalid recovery session on submit anyway), dropping the synchronous `setReady(true)` in the effect. |
| `(app)/institute/page.tsx` | `set-state-in-effect` | Mount fetch moved into an async IIFE inside the effect with an `active` unmount guard, so `setState` is unambiguously post-`await`. |
| `(app)/dashboard/page.tsx` | `purity` | `Date.now()` in an **async Server Component** is correct (renders once per request on the server). Suppressed with a justified `eslint-disable-next-line` explaining the server-render context. |
| `(app)/institute/class/[id]/page.tsx` ×2 | unused-directive | Two `eslint-disable-next-line no-explicit-any` directives were misplaced (the `any` sat a line below their target). Replaced the `any` reduce-callback params with precise inline types and removed the directives. |
| `(auth)/login/page.tsx` | `no-unused-vars` | Removed the unused `router` (and its `useRouter` import) — only referenced in a comment; navigation uses `window.location.href`. |

## Verification (evidence)

- `npx eslint src` → **0 problems** (was 11 warnings). Verified against the
  ESLint v9 flat config from PR #3 (not committed here — it lives in that PR).
- `tsc --noEmit` clean · `npm run test` → **62 passed | 1 skipped** ·
  `npm run build` ok.

## Next (local-light)

- Frontend beautification pass (visual polish on dashboard/profile/practice).
- After Kaggle artifacts land: retrieval recall@k eval + retrieval-augmented
  reasoning lift.
