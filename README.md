# Learning Loop

[![CI](https://github.com/Hraghuwa/learning-loop/actions/workflows/ci.yml/badge.svg)](https://github.com/Hraghuwa/learning-loop/actions/workflows/ci.yml)

Learning Loop is a **reasoning-first CAT preparation platform**.  
It combines a Next.js product experience with a staged reasoning pipeline and a separate FastAPI ML backend for classification, retrieval, and tutoring.

This README documents the repository in detail: architecture, modules, APIs, ML services, datasets, scripts, testing, and deployment.

---

## 1) What this repo contains

At a high level, this monorepo has two serving layers plus shared data/model tooling:

1. **Next.js App (TypeScript)**
   - Product UI (dashboard, practice, tutor, profile, institute flows)
   - App Router API routes for app functionality
   - Proxy route to ML backend (`/api/ml/predict`)
   - Reasoning pipeline route (`/api/solve`) with verifier + memory

2. **FastAPI ML Server (Python)**
   - Endpoints for:
     - `classify` (AutoGluon)
     - `retrieve` (SentenceTransformer + FAISS)
     - `generate` (fine-tuned FLAN-T5)
     - `predict-all` (combined)
     - `tutor` (hybrid grounding + generation strategy)

3. **Data + Training + Build Scripts**
   - Dataset construction/ingestion
   - Retriever index builders
   - Model training/evaluation scripts
   - Utility verifiers and data audits

4. **Supabase SQL Migrations**
   - Initial schema + institute + intelligence/insight layers

---

## 2) Technology stack

### App layer
- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Vitest** for tests

### Integrations
- **Supabase** (Auth + Postgres)
- **Anthropic SDK** (Claude model integration)
- **Razorpay** (payment scaffolding)
- **PostHog** (analytics hooks)

### ML layer
- **FastAPI**
- **AutoGluon** (tabular + multimodal)
- **Sentence Transformers + FAISS** (retrieval)
- **Transformers / FLAN-T5** (generation)

---

## 3) Repository structure (important directories)

```txt
src/
  app/                    # Next.js pages + API routes
    api/solve/route.ts    # staged reasoning pipeline endpoint
    api/ml/predict/route.ts # proxy to python ml backend
    tutor/page.tsx        # tutor UI powered by /api/ml/predict mode=tutor
  pipeline/               # stage prompts, parser, orchestration
  verify/                 # arithmetic/logic/verbal verification helpers
  memory/                 # retrieval memory port + in-memory implementation
  model/                  # model adapters (anthropic/fake)
  classifier/             # problem classification
  consistency/            # majority vote helper
  render/                 # final output rendering
  lib/supabase/           # client/server/admin setup
  components/             # UI components

ml_server/
  main.py                 # FastAPI server for classify/retrieve/generate/tutor

scripts/                  # dataset, training, eval, ingestion, utility scripts
datasets/                 # jsonl data artifacts used by scripts/training
supabase/migrations/      # SQL migrations

tests/                    # Vitest suites by module domain
docs/                     # design docs and plans
```

---

## 4) Core reasoning flow in Next.js (`/api/solve`)

### Entry point
- File: `src/app/api/solve/route.ts`
- Receives JSON `{ problem }`
- Calls `solve(problem, { model, memory, n })`
- Returns rendered output and verification state

### Pipeline orchestration
- File: `src/pipeline/pipeline.ts`
- `solve()` workflow:
  1. Classify input (`classify`)
  2. Initialize scratchpad
  3. Retrieve similar solved traces from memory
  4. Run staged reasoning prompts (`STAGE_NAMES`)
  5. Parse execute/articulation answers
  6. Verify arithmetic programmatically when applicable
  7. Else fallback to best-effort + self-consistency voting
  8. Persist solved trace into memory

### Memory
- File: `src/memory/inmemory.ts`
- Embedding-based cosine similarity search
- Bounded retention via `maxItems` with FIFO eviction of oldest entries

### Verification — the verifier trio

All three verifiers are wired into `solve()` (loop iterations 01 and 06):

| Domain | Verifier | Mechanism | Can mark `verified`? |
|--------|----------|-----------|----------------------|
| arithmetic | `src/verify/arithmetic.ts` | executes the model's Program-of-Thought Python in `src/verify/sidecar.py` | **yes** |
| logic | `src/verify/logic.ts` | Z3/SMT via the sidecar, with a **uniqueness check** (re-solve blocking the found model — bare `sat` only proves ≥1 model, not that the answer is forced) | **yes** (only when the model is unique) |
| verbal | `src/verify/verbal.ts` | LLM entailment judgement (answer vs. source passage) | **no — confidence modulator only** |

**Honesty invariant:** only executed Python and Z3 can produce
`verifyState = 'verified'`. Verbal entailment is a judgement, not a proof, so
it adjusts confidence but the state stays `best-effort`. The accuracy harness
(`tests/golden/accuracy.test.ts`) enforces this: non-arithmetic domains must
have `verified === 0`.

- Confidence/state derive from verifier success and/or self-consistency agreement
- On an LLM/verifier discrepancy in arithmetic, the pipeline performs a
  one-shot re-solve (loop iteration 07)

---

## 5) ML backend (`ml_server/main.py`)

The Python backend is designed as a model-serving hub.

## Endpoints

### `GET /health`
Returns:
- liveness (`ok`)
- currently loaded model handles
- which model artifacts are available on disk

### `POST /classify`
Input:
- `problem`
Output:
- `tabular_subDomain`
- `multimodal_subDomain` (if model loads)
- per-stage latency/error metadata

### `POST /retrieve`
Input:
- `problem`, `top_k`
Output:
- top-K retrieved items with problem/answer/subDomain/score

### `POST /generate`
Input:
- `problem`
Output:
- FLAN-T5 generated answer + latency

### `POST /predict-all`
Runs classify + retrieve + generate in one call.

### `POST /tutor`
Hybrid policy:
- exact-match (high similarity retrieval) when reliable
- retrieval+model (citations + generated answer)
- model-only fallback if retrieval unavailable

Returns:
- final answer
- method
- confidence
- optional subDomain
- citation list
- raw model answer
- latency diagnostics

---

## 6) Next.js ↔ ML backend integration

### Proxy route
- File: `src/app/api/ml/predict/route.ts`
- Validates input with `zod`
- Supports `mode`:
  - `classify`
  - `retrieve`
  - `generate`
  - `predict-all`
  - `tutor`
- Forwards requests to `ML_BACKEND_URL` (default `http://localhost:8000`)
- Provides robust upstream error mapping (502/503 class)

### Tutor UI
- File: `src/app/tutor/page.tsx`
- Chat-style interface
- Requests `POST /api/ml/predict` with `mode: "tutor"`
- Renders:
  - method badges (`exact-match`, `retrieval+model`, `model-only`)
  - confidence bar
  - source citations with score + provenance metadata
  - backend health status pill

---

## 7) Supabase and data model

Migration files in `supabase/migrations`:

- `001_init.sql` – base schema
- `002_institute_codes.sql` – institute-related structures
- `003_intelligence_layer.sql` – intelligence layer additions
- `004_ai_insights.sql` – insights/tutor-related DB evolution

Use `supabase db push` in your configured Supabase project to apply.

---

## 8) Scripts and ML/data workflow

Representative scripts:

- Data assembly/ingestion
  - `scripts/build_combined_dataset.py`
  - `scripts/ingest_math.py`
  - `scripts/ingest_reasoning.py`
  - `scripts/ingest_longform.py`

- Retriever build
  - `scripts/build_retriever.py`
  - `scripts/build_production_retriever.py`

- Training (generation model) — **free by default**
  - `scripts/train_flan_t5.py` — **free local training on your Mac's GPU (Metal/MPS)**;
    trains chain-of-thought solutions on a curated subset of the full corpus. Default path.
  - `scripts/cloud/train_flan_t5_kaggle.py` — **free GPU scale-up** on Kaggle Notebooks
    (T4/P100, 30 hrs/week) for bigger models / full corpus.
  - `scripts/cloud/train_flan_t5_modal.py` — *optional, paid* serverless-GPU path (Modal).
- Training (classifiers)
  - `scripts/train_autogluon_tabular.py`
  - `scripts/train_multimodal.py`
  - `scripts/autogluon_*.py` helpers

- Evaluation/verification
  - `scripts/evaluate_all.py`
  - `scripts/verify-arithmetic.ts`
  - `scripts/verify-bank.ts`

- App data seeding/ops
  - `scripts/seed.ts`
  - `scripts/run.ts`
  - `scripts/questions-bank.ts`

---

## 9) Environment variables

Copy `.env.example` and fill required values.

Common keys include:
- Supabase URL/keys
- Anthropic API key
- Razorpay keys
- PostHog key
- `ML_BACKEND_URL` (for Next.js → FastAPI proxy)

---

## 10) Local development

## A) Install dependencies
```bash
npm install
```

## B) Configure environment
```bash
cp .env.example .env.local
# then edit .env.local
```

## C) Apply DB migrations
```bash
supabase db push
```

## D) Seed question bank (if needed)
```bash
npm run seed
```

## E) Run Next.js app
```bash
npm run dev
```

## F) Run ML backend (separate terminal)
Typical:
```bash
uvicorn ml_server.main:app --reload --port 8000
```

Then:
- Next.js: http://localhost:3000
- ML health through proxy: `GET /api/ml/predict`

---

## 11) NPM scripts

From `package.json`:

- `npm run dev` – Next.js dev server
- `npm run build` – production build
- `npm run start` – production start
- `npm run lint` – ESLint
- `npm run seed` – run `scripts/seed.ts`
- `npm run test` – run Vitest suite
- `npm run solve` – run `scripts/run.ts`

---

## 12) Testing strategy

Tests are organized by subsystem:

- `tests/pipeline/*` – orchestration/stages/scratchpad consistency
- `tests/memory/*` – embedding store + bounded retention behavior
- `tests/model/*` – model adapter behavior
- `tests/verify/*` – arithmetic/logic/verbal verification correctness
- `tests/app/*` – route-level checks
- `tests/golden/*` – golden-case regression checks
- `tests/smoke.test.ts` – overall smoke coverage

Run:
```bash
npm run test
```

---

## 13) Deployment checklist

1. Deploy Next.js app (e.g., Vercel)
2. Set all env vars in deployment platform
3. Run Supabase migrations in target project
4. Ensure Supabase auth/RLS posture is production-safe
5. Deploy Python ML backend separately
6. Set `ML_BACKEND_URL` in Next.js deployment to hosted ML backend URL
7. Verify tutor route, proxy health, and critical APIs post-deploy

---

## 14) Operational notes & troubleshooting

### ML backend unreachable from Next.js
- Check FastAPI is running on configured host/port
- Verify `ML_BACKEND_URL`
- Use `GET /api/ml/predict` health check from Next.js

### Cold start latency
- First requests to model endpoints can be slow due to lazy loading
- Proxy route includes longer timeout for backend generation/classification flows

### Missing model artifacts
- `/health` reports which artifact folders/indexes are present
- Build/train required assets before enabling corresponding endpoints

### In-memory store behavior
- `InMemoryStore` is process memory only; data resets on restart
- Retention is bounded and evicts oldest traces once `maxItems` is exceeded

---

## 15) Product surface summary

Major user-facing capabilities in this repo include:

- Practice and mock test workflows
- AI reasoning analysis and staged solving
- Tutor chat with retrieval-grounded citations
- Profile/insights and study planning APIs
- Institute/class enrollment APIs
- Billing/upgrade scaffolding
- Analytics instrumentation support

---

## 16) Continuous integration

`.github/workflows/ci.yml` runs the full verification gate on every push and
pull request (superseded runs are cancelled to save free-tier minutes):

| Step | Command | Notes |
|------|---------|-------|
| Typecheck | `npx tsc --noEmit` | |
| Lint | `npx eslint .` | skipped on refs that don't yet carry `eslint.config.mjs` |
| Test | `npm run test` | includes the Python-sidecar verifier tests — the runner installs `z3-solver` + `sympy` first |
| Build | `npm run build` | placeholder `NEXT_PUBLIC_SUPABASE_*` env (real values are deploy-time) |

The heavy Python `ml_server` tests require the local AutoGluon venv and run
locally, not in CI.

---

## 17) Free GPU compute (Kaggle)

All heavy ML compute runs on **Kaggle's free GPU tier** (T4/P100, 30 h/week) —
nothing paid, and the local machine stays free for dev:

1. The corpus (~1 GB: math 312k, reasoning 161k, longform 256k, combined-qa 10k)
   is uploaded once as the Kaggle Dataset `learning-loop-corpus`.
2. `scripts/cloud/build_retriever_kaggle.py` — GPU-embeds the full 728k-row
   corpus into a FAISS HNSW index (`st-retriever-prod/`: `faiss.index`,
   `meta.parquet` with citation metadata, saved sentence-transformer).
3. `scripts/cloud/train_flan_t5_kaggle.py` — fine-tunes `flan-t5-base` on
   problem→CoT-solution pairs (`flan-t5-answer/`).
4. Download the notebook outputs into `.st-retriever-prod/` and
   `.flan-t5-answer/` in the repo root — `ml_server` auto-detects both, no code
   changes needed.

`scripts/cloud/train_flan_t5_modal.py` (Modal) exists but is **optional/paid**
and deprioritised.

---

## 18) The self-improvement loop

This repo is continuously improved by an autonomous loop; every iteration is
documented in [`docs/loop/`](docs/loop/) and shipped as a stacked PR:

| # | Iteration | What landed |
|---|-----------|-------------|
| 01 | Logic verification | Z3 wired into `solve()` + SMT uniqueness check (blocking re-solve) |
| 03 | Lint gate | ESLint v9 flat config (`eslint.config.mjs`) |
| 04 | Free training | Local MPS trainer rewrite + Kaggle GPU trainer |
| 05 | Kaggle-first compute | Retriever build on free GPU; workflow doc |
| 06 | Verbal verification | Entailment check as a confidence signal (never `verified`) |
| 07 | Arithmetic re-solve | One-shot re-solve on LLM/verifier discrepancy |
| 08 | Inference quality | `no_repeat_ngram_size=3`, `max_new_tokens=128`, `/tutor` serving |
| 09 | React-Compiler compliance | All 11 `react-hooks/*` warnings → 0 |
| 10 | Design system | A11y focus rings, reduced-motion, `.btn` component layer |
| 11 | CI gate | GitHub Actions workflow (section 16 above) |
| 12 | Button rollout | 18 inline buttons → `.btn` layer across 14 files |
| 13 | Documentation | This README refresh |

Loop conventions: TDD (failing test first), full gate before any PR
(`tsc` + lint + tests + build), one scoped commit per iteration, an evidence
note in `docs/loop/NN-*.md`, and no paid compute anywhere.

---

## 19) License / usage

No explicit OSS license is declared in this repository currently.  
If you plan to open-source, add a `LICENSE` file and clarify dataset/model licensing constraints, especially for citation-enabled tutor corpora.
