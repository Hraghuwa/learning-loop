# APEX-REASON Core Solver — Design Spec

**Date:** 2026-05-18
**Status:** Approved in brainstorming; pending written-spec review
**Context:** Reasoning brain for *Learning Loop / CAT Loop* — an adaptive learning platform for CAT/MBA aspirants.

---

## 1. Problem & Goal

Learning Loop needs a reasoning engine that, given a competitive-exam problem (CAT/GMAT/GRE/SSC-style), produces a fully-derived, structured solution whose **quantitative and closed-form-logic answers are machine-verified, not model-trusted**. It must also tag the problem (domain/difficulty), self-critique, report calibrated confidence, and emit one harder follow-up question.

This spec covers **v1: the Core Solver (SOLVE mode)** only. Other interaction modes, full question generation, and per-learner memory are designed as interfaces but deferred to later sub-projects.

## 2. Scope

### In scope (v1)
- SOLVE mode across all six domains (Arithmetic/Quant, Verbal, Logical Reasoning, Data Interpretation, NLP-parsing layer, Graphical — text-described only).
- The 9-stage chain-of-thought pipeline.
- Deterministic verification harness: Program-of-Thought (Python execution) for arithmetic; Z3/OR-Tools for constraint puzzles; structural checks for sentence correction.
- Self-consistency sampling + majority vote.
- RAG memory store of solved problems (also the accumulating proprietary dataset).
- The fixed output format including a single `【NEW Q】`.
- Minimal Next.js web surface to demo (problem in → structured solution + verification panel).

### Explicitly out of scope (v1) — documented roadmap, not built
- Model training of any kind: pre-training, LoRA/QLoRA fine-tuning, PRM training, GRPO/DPO/RLHF, real MoE weights.
- The 500K–5M step-annotated dataset curation (separate data project; the system *seeds* it).
- TEACH / DIAGNOSE / BATTLE / DEEP-DIVE modes.
- Full 5-method question generation engine (only the single `【NEW Q】` ships in v1).
- Per-learner mastery scoring / adaptive curriculum.
- Image/chart vision input (text-described DI/visual only in v1).

### Honesty model (non-negotiable product principle)
The spec's "100% strike rate across all domains" is **enforceable only where an oracle exists**:
- **Verified** state: Arithmetic/Quant and closed-form Logic — answer is recomputed by Python/Z3 and must match. We claim correctness.
- **Best-effort + confidence** state: Reading Comprehension, Critical Reasoning, Verbal, Graphical — no oracle. We run adversarial self-critique + self-consistency and emit a calibrated confidence score. We do **not** claim certainty.
These two states are distinct and clearly labelled in every output. This honesty is a product requirement, not a limitation to hide.

## 3. Architecture

```
Problem text
   │
   ▼
[Classifier]            LLM, structured JSON → {domain, sub-domain, type, difficulty L1–L5,
   │                                            ambiguity flags}
   ▼
[Pipeline Runner]       drives 9 stages; owns a typed Scratchpad; no external I/O itself
   │   ├─ Stage 1 Ingestion         (LLM)
   │   ├─ Stage 2 Formal repr.      (LLM → formal/symbolic form)
   │   ├─ Stage 3 Strategy select   (LLM; ≥2 strategies, justify)
   │   ├─ Stage 4 Modular execute   (LLM; quant/logic emit code/constraints)
   │   ├─ Stage 5 Constraint verify (LLM self-check)
   │   ├─ Stage 6 Adversarial crit. (LLM counter-solver)
   │   ├─ Stage 7 Alt-method cross  (LLM; second method)
   │   ├─ Stage 8 Option analysis   (LLM; MCQ match)
   │   └─ Stage 9 Articulation      (LLM; final)
   ▼
[Verification Harness]  the part that makes this real:
   ├─ verifier/arithmetic : Program-of-Thought — extract computation, run in
   │                        sandboxed Python (sympy/decimal). Executed value
   │                        IS the answer; LLM prose must reconcile to it.
   ├─ verifier/logic      : translate parsed constraints → Z3/OR-Tools, solve
   │                        independently, compare solution set.
   └─ verifier/verbal     : NOT machine-verifiable → NLI-entailment of answer
                            against passage + structured rubric → confidence.
   ▼
[Self-Consistency]      sample N paths (config; default N=5, temp ~0.7) where
   │                    applicable; majority vote; disagreement → escalate/flag
   ▼
[Memory (RAG)]          retrieve analogous solved problems before solving
   │                    (injected into Stage 2/3); write solved trace after
   ▼
[Output Renderer]       Scratchpad → exact 【PROBLEM TYPE】…【NEW Q】 format,
                        with Verified / Best-effort+confidence labelling
```

## 4. Components & Boundaries

Each unit has one purpose, a typed interface, and is independently testable.

- **`model`** — single interface `complete(messages, opts) → text | structuredJSON`. The *only* place the LLM is touched. A `FakeModel` returning canned responses backs all pipeline tests. Swappable without touching anything else.
- **`classifier`** — `(problemText) → ProblemMeta`. Pure wrapper over one `model` call. v1 = zero-shot LLM; interface unchanged when a trained DeBERTa classifier replaces it later.
- **`pipeline`** — orchestrates stages 1–9, owns the `Scratchpad` type, performs no I/O except via injected `model`/`memory`/`verifier` ports. Deterministic given fixed model outputs.
- **`verifier/arithmetic`** — `(extractedComputation) → ExactValue`. Sandboxed Python subprocess (sympy/decimal). No network; resource/time-limited.
- **`verifier/logic`** — `(parsedConstraints) → SolutionSet`. Z3 (SMT) / OR-Tools. Independent of the LLM's claimed answer.
- **`verifier/verbal`** — `(answer, passage) → {entailment, confidence}`. NLI cross-encoder or LLM-as-NLI behind one interface.
- **`memory`** — `search(problemEmbedding) → SimilarSolved[]`, `write(solvedTrace)`. Vector store (Chroma/FAISS-style) behind a repository interface. Doubles as the accumulating proprietary CoT dataset.
- **`render`** — `(Scratchpad) → formatted output`. Pure function. Enforces the fixed section format and the Verified/Confidence labelling.
- **`web`** — one Next.js page: problem input → solution + collapsible "show verification" panel + confidence badge. No business logic; calls the pipeline.

Boundary test: any unit's internals can change without breaking consumers because all coupling is through the typed ports above.

## 5. Concept → Implementation Mapping

| Spec / reference concept | v1 realization |
|---|---|
| MoE 8 expert pools + router | LLM domain classifier → **prompt-specialized solver profiles** (not MoE weights) |
| "Zero arithmetic error" | **Program-of-Thought**: model writes Python, harness executes, executed result is the answer |
| Logic/puzzle exactness | Parse → **Z3 / OR-Tools** independent solve |
| Self-consistency / verification layers | Sample N, majority vote, NLI + boundary/dimension/range checks |
| Episodic & semantic memory | **RAG** vector store of solved traces (also the dataset moat) |
| Self-learning / question generation | Single `【NEW Q】` in v1; 5-method generator = sub-project 2 |
| PRM / RLHF / fine-tuning / MoE weights | **Roadmap only**; ports left in place (e.g. `model`, `classifier`) so they slot in without rework |
| Metacognition / error taxonomy | Error-type enum recorded on every solved trace (E1–E6); analytics = sub-project 3 |

## 6. Data Flow (one SOLVE request)

1. `web` receives problem text → calls `pipeline.solve(text)`.
2. `classifier` → `ProblemMeta`.
3. `memory.search` → analogous solved problems injected as context.
4. `pipeline` runs stages 1–9, populating `Scratchpad`. Quant stage emits a Python computation; logic stage emits constraints.
5. `verifier/*` independently computes the authoritative answer (quant/logic) or a confidence (verbal).
6. If self-consistency enabled: steps 4–5 repeated N times; majority vote; disagreement raises a flag in the output.
7. Reconciliation: if LLM prose answer ≠ verified answer → pipeline re-runs from Stage 1 once; persistent mismatch → output the **verified** value and flag the discrepancy (never silently average).
8. `memory.write(trace)`.
9. `render` → formatted output with correct Verified/Confidence label.

## 7. Error Handling

- **Verifier mismatch** → one re-solve from Stage 1; then trust the verifier, surface the discrepancy. Never emit an unverifiable quant answer as "verified."
- **Python execution failure / timeout** → mark quant answer "best-effort + low confidence," do not crash.
- **Z3 UNSAT / multiple models** → report "cannot be determined" *with the constraint set shown* (distinct from "not attempted").
- **Classifier low confidence / ambiguity flag** → enumerate interpretations and solve each (per spec Rule 5), label output accordingly.
- **Model interface error** → typed error to `web`; no partial/garbled solution rendered.

## 8. Testing Strategy

- **Verifiers** — deterministic → direct unit tests (arithmetic edge cases, Z3 puzzle fixtures, NLI pairs).
- **Pipeline** — driven by `FakeModel` with canned stage outputs; tests orchestration, reconciliation, re-solve, self-consistency voting — zero API calls.
- **Renderer** — golden-string tests for the fixed format and both label states.
- **End-to-end** — curated golden set of ~20 real CAT problems with known answers; tracks strike rate per domain; quant/logic expected at/near 100% (machine-verified), verbal measured and reported, not asserted.
- **Honesty invariant test** — assert no verbal/RC output is ever emitted with a "Verified" label.

## 9. Tech Stack

- Next.js (App Router) + TypeScript — matches the Learning Loop web product.
- Anthropic SDK as the `model` implementation (swappable).
- Python sidecar for `verifier/arithmetic` (sympy, decimal), sandboxed: no network, time/memory capped.
- Z3 (or OR-Tools) for `verifier/logic`.
- Vector store (Chroma/FAISS-style) behind the `memory` repository interface.
- v1 is stateless per request except the memory store; SQLite/Postgres only needed once sub-project 3 (per-learner) lands.
- No MCP, no third-party tool integrations — matches the "no API/MCP plumbing" intent.

## 10. Roadmap (designed-for, not built in v1)

1. **Sub-project 2 — Question Generation**: 5 methods (parametric, concept-fusion, inverse, hardening, trap-insertion) over the `memory` corpus.
2. **Sub-project 3 — Memory & Metacognition**: per-learner mastery (CMS), error-taxonomy analytics, adaptive curriculum, persistent store.
3. **Sub-project 4 — Interaction modes**: TEACH / DIAGNOSE / BATTLE / DEEP-DIVE on the core.
4. **Sub-project 5 — Delivery surface**: full CAT Loop UI.
5. **Training track (separate brainstorm, needs GPU + data)**: dataset curation from PYQs, LoRA fine-tune of a math-specialized base, PRM on step-level annotations, GRPO/DPO. The `model`/`classifier` ports are designed so a fine-tuned model drops in with no consumer changes. Vision/multimodal for chart images is part of this track.

## 11. Assumptions & Open Questions (resolve before/early in planning)

- **A1:** A capable hosted LLM is available as the reasoning core (confirmed: Option A).
- **A2:** "Sandbox as a deployment constraint" is dropped; the only sandboxing is the Python verifier's process isolation (security requirement, not a platform choice).
- **A3:** v1 accepts text-described problems only; chart/figure images deferred to the training track.
- **A4:** Self-consistency N default = 5; tunable. Cost/latency budget per solve to be set in planning.
- **Q1:** Z3 vs OR-Tools for the logic verifier — decide during planning per puzzle-type coverage.
- **Q2:** Vector store choice (Chroma vs FAISS vs hosted) — decide in planning; interface is fixed regardless.
