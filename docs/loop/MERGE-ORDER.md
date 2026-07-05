# Merge-order guide for the loop PR stack

**As of:** 2026-07-05 · 19 open PRs on `github.com/Hraghuwa/learning-loop`,
all ultimately targeting `blackboxai/repo-docs`.

Stacked PRs (base = another `loop/*` branch) merge **after** their base;
GitHub retargets them to `blackboxai/repo-docs` automatically when the base
merges. Recommended order below groups by track and puts
infrastructure first so every later merge gets CI.

## Recommended order

| Step | PR | Why here |
|------|----|----------|
| 1 | **#19** tailwind-v3 | Fixes `next build` for everyone; nothing depends on it but everything benefits |
| 2 | **#11** ci-gate | Activates the repo-wide CI gate — every later merge gets checked |
| 3 | **#3** eslint-flat-config | Restores the lint step inside that CI gate |
| 4 | **#1** logic-verification | Start of the pipeline track |
| 5 | **#6** verbal-verification | Stacked on #1 |
| 6 | **#7** arithmetic-resolve | Stacked on #6 |
| 7 | **#14** exemplar-quality | Pipeline track, independent of 1/6/7 until merge (see conflicts) |
| 8 | **#15** confidence-calibration | Stacked on #14 |
| 9 | **#17** dataset-guard | Test track |
| 10 | **#18** golden-expansion | Stacked on #17 |
| 11 | **#8** inference-quality | ML-server track (tutor endpoint) |
| 12 | **#16** tutor-ui | UI for #8's endpoint (mergeable anytime; pairs logically with #8) |
| 13 | **#9** frontend-compiler | Frontend track |
| 14 | **#10** design-system | Stacked on #9 |
| 15 | **#12** btn-rollout | Stacked on #10 |
| 16 | **#4** free-mps-training | Training track |
| 17 | **#5** kaggle-compute | Stacked on #4 |
| 18 | **#13** readme-docs | Last: its loop table & claims describe everything above |
| 19 | **#2** modal (optional/paid) | Merge or close — Modal is deprioritised per the free-compute policy |

## Expected conflicts (small, mechanical)

| File | Between | Resolution |
|------|---------|------------|
| `src/pipeline/pipeline.ts` | #1/#6/#7 (verifier dispatch) vs #14/#15 (exemplars + calibration) | Keep both: the dispatch block from the #1/#6/#7 side, plus `formatExemplar` + the calibrated confidence line from #14/#15. The calibrated line replaces `60 + 40*agreement` inside the fallback branch. |
| `tests/golden/accuracy.test.ts` | #6 (verbal entailment response in `scriptFor`) vs #17/#18 (floor guard + 30s timeout) | Keep all three additions — they touch different parts of the file. |
| `src/app/globals.css` | #19 (v3 directives on the base css) vs #10 (v3 directives + design system) | Take #10's version — it already starts with the same three `@tailwind` lines and adds the design system. |
| `tests/pipeline/consistency.test.ts` | #6 (retarget verbal→di) vs #15 (calibration) | No real conflict: #15 asserts n=3 behaviour which is unchanged (87). |

After step 3, **every remaining merge runs the full CI gate** (tsc + lint +
z3/sympy tests + build), so conflict resolutions are machine-checked.

## One-liner for the impatient

```
19 → 11 → 3 → 1 → 6 → 7 → 14 → 15 → 17 → 18 → 8 → 16 → 9 → 10 → 12 → 4 → 5 → 13 → (2)
```
