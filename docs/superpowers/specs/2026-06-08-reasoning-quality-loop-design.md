# Learning Loop — Reasoning-Quality Self-Improvement Loop

**Date:** 2026-06-08
**Status:** Approved
**Owner:** loop (autonomous, plan-once-then-execute)

## 1. Purpose

Stand up a continuous, self-paced improvement loop for the Learning Loop reasoning
system. Phase 1 optimizes **ML / reasoning quality**. Each iteration is one bounded,
end-to-end improvement: triage → TDD → verify (test + lint + build) → document →
commit → push → PR → report → schedule next.

This is an engine, not a one-off. The spec defines the rules of engagement and the
Phase-1 backlog. Each iteration also gets its own short note under `docs/loop/`.

## 2. Rules of engagement

1. **One bounded improvement per iteration.** Small enough to reason about in a single
   context; ends green or is reverted. Never push a broken tree.
2. **Test-driven.** Write a failing test that encodes the improvement first, then
   implement to green. Honor the existing suite (`tests/**`).
3. **Verification before any completion claim.** `npm run test`, `npm run lint`, and
   `npm run build` must pass; the actual output is the evidence.
4. **No API spend in the loop.** All model-dependent paths are exercised through the
   existing `fake` model adapter (`src/model/fake.ts`). Real Anthropic calls are never
   made by the loop.
5. **Scoped commits.** Commit only files the iteration touches (explicit `git add`).
   Pre-existing uncommitted working-tree changes are left untouched.
6. **Publish.** Each iteration → dedicated branch `loop/NN-<slug>` → push → PR against
   `Hraghuwa/learning-loop` with before/after evidence in the body.
7. **Escalate on ambiguity/risk only.** Redesigns, destructive changes, or genuinely
   ambiguous direction pause for a question. Otherwise run autonomously.

## 3. Per-iteration cycle

```
triage → pick highest-value backlog item
  → write failing test (TDD)
  → implement to green
  → npm run test && npm run lint && npm run build   (evidence)
  → docs/loop/NN-<slug>.md + README/spec updates as needed
  → git add <touched files> && commit
  → push loop/NN-<slug> && gh pr create
  → report outcome
  → ScheduleWakeup next iteration
```

## 4. Phase-1 backlog (ML / reasoning quality)

Derived directly from documented deferrals in `src/pipeline/pipeline.ts`.

| # | Item | Why it matters | State |
|---|------|----------------|-------|
| 1 | **Wire logic verification into `solve()`** | `verifyLogic` (Z3 via `src/verify/sidecar.py`) is unit-tested but never called by the pipeline. Logic problems are correct but `verifyState` is never `verified`. | First |
| 2 | Wire verbal entailment verification (`verifyVerbal`) | Unused; would raise verbal-domain confidence with a real signal. | Queued |
| 3 | Arithmetic re-solve loop on discrepancy | Design spec §6 step 7 — currently surfaces discrepancy but never re-solves. | Queued |
| 4 | Self-consistency (n>1) + confidence calibration | Calibrate confidence to agreement/verification across domains. | Queued |
| 5 | Eval-harness gates in CI + ML-server tutor/retrieval accuracy | Per-domain strike-rate as a regression gate. | Queued |

The backlog is living: each iteration re-triages and may insert newly-discovered,
higher-value work ahead of queued items.

## 5. Iteration 1 — wire logic verification (detailed)

**Problem.** `solve()` only machine-verifies the `arithmetic` domain. For `logic`,
control falls through to best-effort + self-consistency even though `verifyLogic`
(a Z3-backed SMT solver sidecar) exists and passes its unit tests.

**Approach.**
- Add an SMT-LIB extraction path: the `formal`/`execute` stages can emit a fenced
  ```smt block; parse it (mirroring `parseExecute`'s ```python handling).
- In `solve()`, when `meta.domain === 'logic'` and an SMT program is present, call
  `verifyLogic(smt)`. On `status === 'sat'` with a unique solution, set
  `verifyState = 'verified'`, populate `verifiedAnswer`/`confidence`, and surface a
  discrepancy if the LLM answer disagrees — symmetric with the arithmetic branch.
- `status === 'multiple'` (non-unique model) or `unsat`/`error` → best-effort, with the
  reason recorded in `s.discrepancy`. Never falsely mark `verified`.

**Tests (written first).**
- A `solve()`-level test using the `fake` model: a logic problem whose `formal` stage
  emits SMT yielding a unique `sat` solution ⇒ `verifyState === 'verified'`.
- A test that a non-unique (`multiple`) result stays `best-effort` and is never
  falsely verified.
- Extend the golden/accuracy harness expectation: logic `verified` count may rise from
  0 without ever exceeding `correct`.

**Out of scope (this iteration):** verbal verification, the re-solve loop, SMT prompt
quality tuning beyond what a deterministic `fake`-model fixture needs.

**Definition of done.** New tests green; full suite + lint + build green; logic problems
that produce valid SMT are machine-verified; docs/loop note + PR opened.

## 6. Non-goals

- No frontend work in Phase 1 (deferred to a later phase).
- No changes to deployment, auth, or billing.
- No real model/API calls from the loop.
- No bundling of pre-existing uncommitted working-tree changes.

## 7. Risks & mitigations

- **`python3`/Z3 availability for the sidecar** — `verifyLogic` shells out to
  `src/verify/sidecar.py`. Tests that depend on it must skip gracefully if the sidecar
  is unavailable, but the `solve()` wiring tests use the `fake` model and assert
  behavior given a stubbed verifier result where the real sidecar isn't guaranteed.
- **False "verified"** — only a unique `sat` model verifies; everything else is
  best-effort. This invariant is asserted by the accuracy harness.
- **Working-tree noise** — explicit scoped `git add` per iteration.
