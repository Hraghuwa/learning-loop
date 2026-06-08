# Learning Loop

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

### Verification
- Arithmetic verification via `src/verify/arithmetic.ts` + sidecar strategy
- Logic verifier exists but is intentionally not fully wired into v1 final decision path
- Confidence/state derive from verifier success and/or self-consistency agreement

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

- Heavy ML compute — **free on Kaggle GPU (recommended; keeps your machine idle)**
  - `scripts/cloud/build_retriever_kaggle.py` — build the production retriever on a
    free Kaggle T4/P100 (minutes, not ~1.5 hrs on a laptop CPU).
  - `scripts/cloud/train_flan_t5_kaggle.py` — fine-tune the generation model on a free
    Kaggle GPU (T4/P100, 30 hrs/week).
  - End-to-end Kaggle workflow: `docs/loop/05-kaggle-compute.md`.
  - `scripts/train_flan_t5.py` — *optional* local training on your Mac's GPU (MPS); works,
    but uses your machine. Prefer Kaggle for heavy runs.
  - `scripts/cloud/train_flan_t5_modal.py` — *optional, paid* serverless-GPU path (Modal).
- Training (classifiers) — also Kaggle-friendly
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

## 16) License / usage

No explicit OSS license is declared in this repository currently.  
If you plan to open-source, add a `LICENSE` file and clarify dataset/model licensing constraints, especially for citation-enabled tutor corpora.
