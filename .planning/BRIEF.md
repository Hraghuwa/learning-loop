# Learning Loop — Authentic Tutor (v1.1)

## Current State (Updated: 2026-05-28)

**Shipped:** v1.0 ML Playground (2026-05-28)
**Status:** Local dev, single user (the founder), not yet deployed
**Codebase:**
- Next.js 14 (App Router) + Supabase + Tailwind
- Python ML stack in `~/autogluon-env` (AutoGluon, sentence-transformers, FLAN-T5, transformers)
- `ml_server/` FastAPI backend, `src/app/ml-playground/` UI, `src/app/api/ml/predict/` proxy
- Combined dataset of 10.5K Q&A: GSM8K + AQuA-RAT + 20 authored CAT problems

**v1.0 ships:**
- Tabular subDomain classifier (99.5% holdout)
- Sentence-transformer + FAISS retriever over 10.5K problems
- FLAN-T5-small fine-tuned for answer generation (weak — needs more data)
- AutoGluon MultiModal (training in progress)

**Known Issues:**
- FLAN-T5 hallucinates (1 epoch, 1.8K rows is not enough)
- No source citations on answers — can't claim "authentic"
- Dataset is math-heavy; thin on verbal/logical reasoning
- No generative or adaptive capability yet
- No deployment, no auth on `/ml-playground`

## v1.1 Goals

**Vision:** A tutor that answers any CAT/JEE/NEET-style question with a
verified, cited solution AND can generate new on-style practice questions
that adapt to the learner. Every answer must be backed by a source we can
legally show.

**Motivation:**
- Current FLAN-T5 hallucinates → not deployable
- "Authentic answer" means *cited from a verifiable source*, not "model is confident"
- Need much more training/retrieval material — but only *legally clean* material
- The bar is "would a real student / regulator accept this?" — citation gives us that

**Scope (v1.1):**
1. **Open educational datasets** ingested + indexed (OpenMathInstruct-2, MMLU, MATH, GSM8K, NPTEL transcripts, OpenStax CC-licensed textbooks). Target: 500K+ rows of cited Q&A and lessons.
2. **Public exam corpus** ingested (CAT/JEE/NEET/UPSC/GATE official past papers in public domain).
3. **RAG layer with citations** — every answer returns the source passages it used.
4. **Generation** — fine-tune a stronger seq2seq (FLAN-T5-base) on cited problem→solution pairs, OR use frontier LLM (Claude API) with RAG prompt template.
5. **Adaptive loop** — track user's weak subDomains in Supabase, route next question accordingly.
6. **Frontend updates** — show citations inline, weak-area dashboard, generation page.

**Success Criteria:**
- [ ] ≥500K legally-licensed Q&A rows ingested with source attribution
- [ ] Every answer the tutor returns includes ≥1 citation with link to source
- [ ] Answer accuracy on held-out CAT past paper questions ≥75% (vs current ~10% on FLAN-T5)
- [ ] Generation: produce 50 new CAT-style problems judged on-style by a human (founder) at ≥70%
- [ ] Adaptive: user's weakest subDomain identified within 10 attempts and used to pick next question
- [ ] Zero scraped/copyrighted content in training data (audit-able list of source licenses)
- [ ] Deployed to Vercel (frontend) + a Python host (Fly.io/Modal/Railway) for ML

**Out of Scope (v1.1):**
- Scraping any commercial coaching institute (Byju's, Aakash, Allen, etc.) — legally radioactive
- Premium video lecture ingestion (copyright)
- Multilingual (English-only for v1.1)
- Mobile app
- Live tutoring / human-in-the-loop
- Payments/billing (already partially built but not in this iteration's critical path)

## Constraints

- **Hardware:** macOS M1, ~4 GB free RAM, no GPU. Heavy training must run on Modal/Colab/Lambda Labs or be CPU-tractable.
- **Cost:** Open-source first. Frontier LLM (Claude API) is allowed for answer generation in production but not for bulk pre-processing.
- **Legal:** Every ingested row must have a documented license (CC-BY, CC0, public domain, MIT/Apache, or explicit permission).
- **Stack:** Stay on existing Next.js 14 + Supabase + Python FastAPI. No new languages/frameworks.

---

<details>
<summary>Original Vision (v1.0 — Archived)</summary>

**One-liner:** Demonstrate end-to-end ML pipeline (train + serve + integrate
with Next.js frontend) on CAT-style problems.

## Problem
Wanted to see all the AutoGluon/transformer training approaches actually
working on real user-input text in the existing learning app.

## Success Criteria
- [x] Multiple models trained (tabular, retriever, FLAN-T5)
- [x] FastAPI backend wraps all models
- [x] Next.js page lets a user input a question and see each model's output
- [x] Works end-to-end locally

</details>
