# Phase 5 Plan 01: Open-dataset license audit — Summary

**Cataloged 17 open educational dataset candidates totalling ~22.78M rows of legally usable Q&A and textbook content (~783K rows even excluding the 22M-row nvidia/OpenMathInstruct-2).**

## Accomplishments
- Wrote re-runnable HF metadata auditor (`scripts/audit_datasets.py`) covering 17 candidates across math / reasoning / instruct / textbook.
- 14/17 candidates resolved from HuggingFace metadata in one pass — license + row count fetched cleanly.
- Produced `LICENSES.md` as the canonical gate for downstream ingestion plans.
- 11 datasets approved (`INCLUDE = yes`); 6 excluded or deferred with explicit reasons.

## Files Created/Modified
- `scripts/audit_datasets.py` — new, re-runnable HF metadata fetcher with permissive/restrictive license classifier.
- `.planning/phases/05-open-ed-datasets/LICENSES.md` — new, manifest + INCLUDE column + deferred section.
- `.planning/ROADMAP.md` — flipped `05-01` to done, progress row updated to `1/4`.

## Decisions Made
- **Excluded `allenai/sciq`** — `cc-by-nc-3.0` (non-commercial). Hard exclude per the project's commercial-use rule.
- **Deferred `lukaemon/bbh`, `allenai/openbookqa`** — HF card lacks a license field; revisit only if Phase 5 row totals fall short. Both marked `INCLUDE = no` until manually verified.
- **Deferred `MohamedRashad/openstax-textbooks`** — HF metadata fetch did not return useful info; for OpenStax we'll pull from canonical openstax.org CC-BY PDFs in 05-04 rather than rely on a community mirror.
- Kept `nampdn-ai/tiny-textbooks` and `TIGER-Lab/MathInstruct` as `INCLUDE = yes` despite missing row counts in the card — licenses are clearly permissive (Apache-2.0 / MIT); row counts will be confirmed at ingest in 05-02.

## Issues Encountered
- One HF metadata call failed (`MohamedRashad/openstax-textbooks`) — handled gracefully via try/except, logged as TODO row in `LICENSES.md` rather than failing the whole audit.
- A few datasets (tiny-textbooks, MathInstruct) don't expose `dataset_info.splits` in their card; row counts are reported as `?` and deferred to ingest time.

## Verification
- ✅ Script runs without crashing (`python scripts/audit_datasets.py` exits 0).
- ✅ `LICENSES.md` exists, 31 markdown table rows, INCLUDE column populated.
- ✅ INCLUDE=yes aggregate row count is **~22.78M** (or **~783K** excluding the 22M-row OpenMathInstruct-2) — well above the 500K Phase-5 target.
- ✅ No CC-BY-NC dataset is marked INCLUDE=yes (sciq explicitly excluded).
- ✅ No unresolved-license dataset is marked INCLUDE=yes (bbh, openbookqa, openstax-mirror all `no`).

## Next Step
Ready for `05-02-PLAN.md` (math corpora ingestion against the approved list).
