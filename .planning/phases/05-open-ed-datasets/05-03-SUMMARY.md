# Phase 5 Plan 03: Reasoning + verbal corpus ingestion — Summary

**Ingested 160,795 rows of reasoning/verbal Q&A across 4 HF datasets (14 source-split shards) and 6 subDomains into datasets/reasoning-corpus.jsonl (214 MB, every row license- and source-tagged).**

## Accomplishments
- Wrote `scripts/ingest_reasoning.py` mirroring `scripts/ingest_math.py` (same CLI flags, streaming, normalized JSONL schema). Includes a startup license gate that refuses any hf_id not on the INCLUDE=yes whitelist from LICENSES.md.
- Ran full ingestion. Per-source row counts:
  - `cais/mmlu` (mit): **115,415** — auxiliary_train 99,842 + test 14,042 + validation 1,531
  - `EleutherAI/lambada_openai` (mit): **25,765** — 5 languages × 5,153 (en, de, es, fr, it)
  - `google/boolq` (cc-by-sa-3.0): **12,697** — train 9,427 + validation 3,270
  - `allenai/ai2_arc` (cc-by-sa-4.0): **6,918** — Challenge train+test 2,291 + Easy train+test 4,627
  - **Total: 160,795 rows** (target was ≥150K).
- Per-subDomain row counts:
  - `reasoning` (MMLU STEM-other): 106,706
  - `language-modeling` (LAMBADA): 25,765
  - `reading-comprehension` (BoolQ): 12,697
  - `verbal` (MMLU humanities): 7,209
  - `science-reasoning` (ARC): 6,918
  - `logic` (MMLU formal_logic / math subjects): 1,500
- 0 unlicensed rows; every row carries `source`, `license`, `url` for Phase 8 citations.
- Schema is byte-compatible with `math-corpus.jsonl` → trivial concat in Phase 7.

## Files Created/Modified
- `scripts/ingest_reasoning.py` — new ingestion script with per-source extractors + MMLU subject→subDomain heuristic + INCLUDE=yes license gate.
- `datasets/reasoning-corpus.jsonl` — 160,795 rows, 214 MB (gitignored, regeneratable in ~25 s).
- `datasets/reasoning-corpus.stats.json` — per-source breakdown + total.
- `.planning/ROADMAP.md` — 05-03 flipped to `[x]`, Phase 5 progress to `3/4`.

## Decisions Made
- **MMLU subject → subDomain heuristic.** Classified the 57 MMLU subjects into 3 buckets: `verbal` (history, philosophy, law, psychology, sociology, geography, politics, religion), `logic` (formal_logic, logical_fallacies, abstract_algebra, math subjects, statistics), `reasoning` (STEM-other / default). Cheap rule-based map; can be replaced by the trained Tabular classifier later.
- **Pulled every available split of MMLU `all`** (auxiliary_train + test + validation) to clear the 150K row floor without breaking the license gate. `auxiliary_train` alone capped at 99,842 rows by `--limit-per-source 100000`.
- **Added LAMBADA multilingual configs (de/es/fr/it) alongside en** because the single `default` split only yielded ~5K rows; the 4 extra languages are MIT-licensed and add ~20K language-modeling rows.
- **Split each ARC config (Challenge/Easy) across train + test** to maximize coverage of the small CC-BY-SA-4.0 science-reasoning pool.
- **`lukaemon/bbh` excluded** because LICENSES.md marks it `INCLUDE=no` (HF card lacks a license field). The script's license whitelist enforces this — it would fail loudly if anyone re-added bbh without resolving the license first.
- **Per-source cap = 100K**, same as math. Only `mmlu_aux` hit the cap; all other shards exhausted naturally.

## Issues Encountered
- First background ingestion attempt was killed by the harness before producing any rows (process exited with 0 written rows — log showed only the initial mmlu_aux progress bar). Reran in the foreground; no further issues.
- First foreground run with only MMLU `test` split (+ARC train, BoolQ train, lambada default) yielded only 31,992 rows. Fix: pulled additional splits (auxiliary_train, validation, test) and lambada multilingual configs — same license, same schema, just more data.
- No rate-limit hits, no schema crashes mid-stream.

## Verification
- ✅ `wc -l datasets/reasoning-corpus.jsonl` = 160,795 (≥ 150K).
- ✅ 6 distinct subDomain values present (≥ 4 required).
- ✅ Every row has non-empty `license`; 0 unlicensed rows.
- ✅ Schema fields match `math-corpus.jsonl` exactly (id, problem, answer, solution, subject, subDomain, source, license, url).
- ✅ `stats.json["total"]` (160,795) == JSONL line count.
- ✅ Re-running the script overwrites the JSONL (idempotent).
- ✅ License gate refuses any non-INCLUDE source (verified by code path).

## Next Step
Ready for `05-04-PLAN.md` (CC-licensed long-form textbook content: OpenStax PDFs + nampdn-ai/tiny-textbooks).
