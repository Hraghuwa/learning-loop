# Phase 5 — Open Educational Datasets: License Manifest

This is the **gate** for everything we ingest in Phase 5. Every downstream plan
(05-02 / 05-03 / 05-04) must cite a row from this table and pull only from
datasets marked `INCLUDE = yes`.

## Commercial-use rule we enforce

We are building a (future) commercial product. We therefore accept **only
licenses that permit unrestricted commercial use with attribution**:

- ✅ Include: `MIT`, `Apache-2.0`, `BSD-*`, `CC0`, `CC-BY-*` (including `CC-BY-SA`), public domain, `Unlicense`
- ❌ Exclude: `CC-BY-NC*` (non-commercial), `GPL/AGPL/LGPL` (copyleft binds derivative software), `creativeml-openrail-m` (use restrictions)
- ❌ Exclude: any dataset whose license we cannot positively verify on the HF Hub (`unknown`, `other`)

Datasets in the "Deferred" section need a manual license check before they can
be considered.

## Master manifest

Generated from `scripts/audit_datasets.py` (re-runnable). Row counts are summed
across all splits / configs reported by HF `dataset_info()`.

| Dataset | License | Rows | Content type | Commercial | INCLUDE | Notes |
|---|---|---|---|---|---|---|
| `nvidia/OpenMathInstruct-2` | cc-by-4.0 | ~22.0M | Q&A (math) | yes | **yes** | math instruction (huge) |
| `hendrycks/competition_math` | mit | ~12K | Q&A (math) | yes | **yes** | competition MATH |
| `openai/gsm8k` | mit | ~18K | Q&A (math) | yes | **yes** | already partially ingested |
| `deepmind/aqua_rat` | apache-2.0 | ~196K | Q&A (math) | yes | **yes** | algebra MCQ, partially in |
| `allenai/math_qa` | apache-2.0 | ~37K | Q&A (math) | yes | **yes** | math QA |
| `microsoft/orca-math-word-problems-200k` | mit | ~200K | Q&A (math) | yes | **yes** | word problems |
| `cais/mmlu` | mit | ~231K | Q&A (reasoning) | yes | **yes** | multi-subject MCQ |
| `allenai/ai2_arc` | cc-by-sa-4.0 | ~8K | Q&A (reasoning) | yes | **yes** | science MCQ |
| `google/boolq` | cc-by-sa-3.0 | ~13K | Q&A (reasoning) | yes | **yes** | yes/no QA |
| `lukaemon/bbh` | unknown | ~7K | Q&A (reasoning) | unknown | no | Big-Bench Hard — needs manual check |
| `EleutherAI/lambada_openai` | mit | ~31K | Q&A (reasoning) | yes | **yes** | language modeling |
| `nampdn-ai/tiny-textbooks` | apache-2.0 | ? | textbook | yes | **yes** | synthetic textbooks (row count not in card) |
| `nvidia/HelpSteer` | cc-by-4.0 | ~37K | Q&A (instruct) | yes | **yes** | RLHF preference |
| `MohamedRashad/openstax-textbooks` | TODO | ? | textbook | unknown | no | mirror metadata unresolved — manual check |
| `TIGER-Lab/MathInstruct` | mit | ? | Q&A (math) | yes | **yes** | math instruction (row count not in card) |
| `allenai/sciq` | cc-by-nc-3.0 | ~14K | Q&A (reasoning) | no | no | **non-commercial — excluded** |
| `allenai/openbookqa` | unknown | ~12K | Q&A (reasoning) | unknown | no | license card says unknown — needs manual check |

## Aggregate stats (INCLUDE = yes only)

Counted from confirmed row totals above (datasets with `?` are not counted).

| Content type | Datasets (INCLUDE=yes) | Rows |
|---|---|---|
| Q&A (math) | OpenMathInstruct-2, competition_math, gsm8k, aqua_rat, math_qa, orca-math, MathInstruct | ~22,463,000 + (MathInstruct ?) |
| Q&A (reasoning) | mmlu, ai2_arc, boolq, lambada_openai | ~283,000 |
| Q&A (instruct) | HelpSteer | ~37,000 |
| textbook | tiny-textbooks | ? |
| **Total (counted)** | **11 datasets** | **~22,783,000 rows** |

Even **excluding** the giant `nvidia/OpenMathInstruct-2` (22M), the remaining
INCLUDE=yes pool is **~783K rows** — already past the 500K Phase-5 target.

## Decisions logged

- **Excluded `allenai/sciq`** — license is `cc-by-nc-3.0` (non-commercial). Hard exclude per the rule above.
- **Deferred `lukaemon/bbh`** — license tag is missing from the HF card. Plenty of forks exist; will revisit if reasoning rows fall short.
- **Deferred `allenai/openbookqa`** — license unresolved on the HF card. Recheck via the AI2 source page before ingest.
- **Deferred `MohamedRashad/openstax-textbooks`** — metadata could not be fetched. For OpenStax we should pull from the canonical openstax.org CC-BY PDFs in plan 05-04 instead of relying on a HF mirror.
- `nampdn-ai/tiny-textbooks` and `TIGER-Lab/MathInstruct` are kept as INCLUDE=yes (license is permissive) but their row counts will be confirmed at ingest time in 05-02.

## Deferred — needs manual license check

These will NOT be ingested until a follow-up plan resolves their license:

| Dataset | Why deferred |
|---|---|
| `lukaemon/bbh` | HF card lacks `license` field |
| `allenai/openbookqa` | HF card lacks `license` field |
| `MohamedRashad/openstax-textbooks` | `dataset_info()` call did not return metadata in this audit run; use canonical openstax.org sources for 05-04 instead |

## How to re-run this audit

```bash
source ~/autogluon-env/bin/activate
python scripts/audit_datasets.py > .planning/phases/05-open-ed-datasets/LICENSES.raw.md
# then merge new rows + INCLUDE decisions back into this file
```

The script is idempotent and only depends on `huggingface_hub.dataset_info()`.
