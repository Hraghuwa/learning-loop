# Roadmap: Learning Loop — Authentic Tutor

## Overview

v1.0 shipped a working ML playground locally. v1.1 turns it into a *deployable
tutor that gives cited, authentic answers* by ingesting only legally-clean
educational material at scale, then layering RAG + generation + adaptive logic
on top. The journey is: legal-data → cited-retrieval → trustworthy-generation
→ adaptive-loop → ship.

## Milestones

- ✅ **v1.0 ML Playground** — Phases 1–4 (shipped 2026-05-28)
- 🚧 **v1.1 Authentic Tutor** — Phases 5–11 (in progress)
- 📋 **v2.0 Multi-subject + deploy at scale** — Phases 12+ (planned, not yet detailed)

## Phases

<details>
<summary>✅ v1.0 ML Playground (Phases 1–4) — SHIPPED 2026-05-28</summary>

### Phase 1: Tabular classification baseline
**Goal**: Prove AutoGluon works on the 20-row cat-pyq dataset.
**Plans**: 1

- [x] 01-01: Train AutoGluon Tabular for domain/subDomain/answer

### Phase 2: Bigger dataset + benchmark
**Goal**: Combine GSM8K + AQuA-RAT + cat-pyq into 10.5K rows; train Tabular on it.
**Plans**: 2

- [x] 02-01: Build combined-qa.jsonl
- [x] 02-02: Train AutoGluon Tabular subDomain classifier

### Phase 3: Add retrieval + generation
**Goal**: Sentence-transformer + FAISS retriever; FLAN-T5-small fine-tune for answer generation.
**Plans**: 2

- [x] 03-01: Build sentence-transformer retriever
- [x] 03-02: Fine-tune FLAN-T5-small

### Phase 4: Backend + frontend integration
**Goal**: All models accessible from the Next.js app via a single playground page.
**Plans**: 3

- [x] 04-01: FastAPI backend (`ml_server/`)
- [x] 04-02: Next.js `/api/ml/predict` proxy route
- [x] 04-03: `/ml-playground` UI page

</details>

### 🚧 v1.1 Authentic Tutor (In Progress)

**Milestone Goal:** A deployable tutor that returns cited, authentic answers,
generates on-style practice problems, and adapts to the learner.

#### Phase 5: Legal data foundation — open educational datasets
**Goal**: Ingest every legally-clean academic Q&A and lesson corpus we can find. Every row tagged with its license and source URL. Target ≥500K rows.
**Depends on**: Phase 4 ✅
**Plans**: 4 (small, atomic)

- [x] 05-01: Inventory + license audit of candidate open datasets (HF list + license check)
- [x] 05-02: Ingest math corpora (OpenMathInstruct-2, MATH, MMLU-stem, GSM8K already in)
- [ ] 05-03: Ingest verbal/logical corpora (MMLU-humanities, LSAT-AR, BoolQ, ARC)
- [ ] 05-04: Ingest CC-licensed long-form (OpenStax chapters, NPTEL transcript subset)

#### Phase 6: Public-domain exam corpus
**Goal**: Add officially-released past papers (CAT, JEE, NEET, UPSC, GATE). Public domain by virtue of being released by govt/IIM.
**Depends on**: Phase 5
**Plans**: 3

- [ ] 06-01: Identify + verify sources (official IIM CAT site, NTA, UPSC archives)
- [ ] 06-02: Scrape only the explicitly-released PDFs + parse to structured Q&A
- [ ] 06-03: Normalize into combined schema; merge with Phase 5 dataset

#### Phase 7: Dataset hygiene + dedup + storage
**Goal**: Final clean corpus stored in a queryable form (sqlite + parquet + FAISS) with every row carrying license metadata.
**Depends on**: Phase 6
**Plans**: 2

- [ ] 07-01: Dedup (MinHash), language filter (English), length filter, PII scan
- [ ] 07-02: Build production retrieval index (FAISS HNSW + sqlite metadata)

#### Phase 8: RAG layer with citations
**Goal**: Answers come from retrieved passages, always with source citations rendered in UI.
**Depends on**: Phase 7
**Plans**: 3

- [ ] 08-01: Prompt template that forces "answer + cited passages" structure
- [ ] 08-02: Wire RAG into FastAPI `/answer` endpoint (retrieve → rerank → LLM call)
- [ ] 08-03: UI: render citations inline with source links + license badge

#### Phase 9: Trustworthy generation (answers + new problems)
**Goal**: Choose generation strategy and ship it: (a) Claude/GPT API + RAG prompt OR (b) fine-tune FLAN-T5-base on cited Q&A. Decision in 09-01.
**Depends on**: Phase 8
**Plans**: 3

- [ ] 09-01: Decision spike: API-RAG vs fine-tune (small bench, pick winner)
- [ ] 09-02: Implement chosen approach for answer generation
- [ ] 09-03: Implement question generation (style-conditioned: "give me a CAT-style time-speed-distance problem")

#### Phase 10: Adaptive loop
**Goal**: Track each user's weak subDomains in Supabase; next-question recommender picks accordingly.
**Depends on**: Phase 9
**Plans**: 2

- [ ] 10-01: Supabase schema for attempt tracking + weak-area aggregation
- [ ] 10-02: Recommender endpoint + UI "next question" CTA

#### Phase 11: Ship v1.1
**Goal**: Deploy frontend + backend; gate `/ml-playground` and `/tutor` behind auth; remove the ML cold-start blocker.
**Depends on**: Phase 10
**Plans**: 3

- [ ] 11-01: Containerize FastAPI; deploy to Modal/Fly.io
- [ ] 11-02: Configure `ML_BACKEND_URL` + Vercel env; gate ML routes behind Supabase auth
- [ ] 11-03: Smoke tests, license-audit doc, v1.1 release notes, git tag

### 📋 v2.0 Scale (Planned — not detailed yet)

**Milestone Goal:** Multi-subject (physics, chem, bio, GK), multilingual, mobile app, paid plan. Detail when v1.1 ships.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Tabular baseline | v1.0 | 1/1 | Complete | 2026-05-28 |
| 2. Bigger dataset | v1.0 | 2/2 | Complete | 2026-05-28 |
| 3. Retrieval + gen | v1.0 | 2/2 | Complete | 2026-05-28 |
| 4. Backend + frontend | v1.0 | 3/3 | Complete | 2026-05-28 |
| 5. Open ed datasets | v1.1 | 2/4 | In progress | — |
| 6. Public exam corpus | v1.1 | 0/3 | Not started | — |
| 7. Hygiene + storage | v1.1 | 0/2 | Not started | — |
| 8. RAG + citations | v1.1 | 0/3 | Not started | — |
| 9. Trustworthy gen | v1.1 | 0/3 | Not started | — |
| 10. Adaptive loop | v1.1 | 0/2 | Not started | — |
| 11. Ship v1.1 | v1.1 | 0/3 | Not started | — |
