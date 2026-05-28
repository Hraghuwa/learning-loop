# Phase 5 Plan 02: Math corpus ingestion — Summary

**Ingested 312,425 math Q&A rows from 6 licensed sources into datasets/math-corpus.jsonl (299 MB, every row license- and source-tagged).**

## Accomplishments
- Wrote `scripts/ingest_math.py`: streaming HF ingestion with per-source extractors, schema normalization, sub-domain heuristic, license stamping, idempotent rewrite, CLI flags (`--limit-per-source`, `--source-caps`, `--sources`).
- Ran full ingestion. Per-source row counts:
  - `nvidia/OpenMathInstruct-2` (cc-by-4.0): 15,000
  - `qwedsacf/competition_math` mirror of MATH (mit): 12,485
  - `openai/gsm8k` (mit): 7,473
  - `deepmind/aqua_rat` (apache-2.0): 97,467
  - `microsoft/orca-math-word-problems-200k` (mit): 100,000
  - `TIGER-Lab/MathInstruct` (mit): 80,000
  - **Total: 312,425 rows** (target was ≥200K).
- 0 rows missing `source` or `license` — citation layer in Phase 8 can rely on it.
- Sub-domain heuristic tags each row as algebra / geometry / arithmetic / word-problem / other.

## Files Created/Modified
- `scripts/ingest_math.py` — new ingestion script
- `datasets/math-corpus.jsonl` — 312,425 rows, 299 MB (gitignored, regeneratable)
- `datasets/math-corpus.stats.json` — per-source breakdown + total
- `.gitignore` — added `datasets/*-corpus.jsonl` and `datasets/*-corpus.stats.json` so the 299 MB corpus is not committed
- `.planning/ROADMAP.md` — 05-02 flipped to `[x]`, progress row updated to `2/4`

## Decisions Made
- **Substituted `hendrycks/competition_math` → `qwedsacf/competition_math`.** The original was removed from the Hub; the mirror has identical `{problem, level, type, solution}` schema and underlying MATH benchmark is MIT-licensed (Hendrycks et al., 2021).
- **Dropped `allenai/math_qa`.** HF no longer supports its loading script ("Dataset scripts are no longer supported"); no clean apache-2.0 parquet mirror with the original `{Problem, correct, Rationale}` schema was located. Extractor left in code for future re-enable.
- **Per-source cap = 100K**, with overrides `OpenMathInstruct-2:15000` (22 M rows total — capped to stay under ~3 GB JSONL) and `MathInstruct:80000`. Smaller sources hit their natural ceilings (gsm8k 7.4K, competition_math 12.5K, aqua_rat 97.5K).
- **Sub-domain heuristic** is regex-based on problem text — algebra/geometry/word-problem/arithmetic/other. Cheap and good enough for downstream filtering; can be replaced with the trained Tabular classifier later.
- Corpus file gitignored because it's regeneratable in ~30 s end-to-end from the script (HF cache makes the rerun near-instant).

## Issues Encountered
- 2 sources required schema/availability handling (competition_math substituted, math_qa dropped) — both logged in this summary and as code comments in `ingest_math.py`.
- No rate-limit hits, no row-schema crashes mid-stream.

## Verification
- ✅ `wc -l datasets/math-corpus.jsonl` = 312,425 (≥ 200K).
- ✅ 6 distinct sources contribute (≥ 3).
- ✅ Every sampled row has non-empty `id`, `problem`, `answer`, `source`, `license`.
- ✅ `stats.json["total"]` == JSONL row count.
- ✅ Re-running the script overwrites the JSONL (idempotent).

## Next Step
Ready for `05-03-PLAN.md` (verbal + logical reasoning corpora: mmlu, ai2_arc, boolq, lambada_openai, HelpSteer).
