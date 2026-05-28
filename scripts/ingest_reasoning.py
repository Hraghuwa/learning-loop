"""
Ingest reasoning / verbal datasets approved (INCLUDE=yes) in LICENSES.md into a
single normalized JSONL at datasets/reasoning-corpus.jsonl. Mirrors the schema
of math-corpus.jsonl so the two can be trivially concatenated in Phase 7.

Run:
    source ~/autogluon-env/bin/activate
    python scripts/ingest_reasoning.py                       # full run, 100K/source cap
    python scripts/ingest_reasoning.py --limit-per-source 50 # smoke test
    python scripts/ingest_reasoning.py --sources mmlu,boolq

LICENSES.md gate (INCLUDE=yes only):
    cais/mmlu                  mit
    allenai/ai2_arc            cc-by-sa-4.0
    google/boolq               cc-by-sa-3.0
    EleutherAI/lambada_openai  mit

Explicitly excluded (INCLUDE=no per LICENSES.md):
    lukaemon/bbh              license tag missing on HF card — deferred
"""

from __future__ import annotations

import argparse
import json
import sys
import traceback
from pathlib import Path
from typing import Callable, Iterable

from datasets import load_dataset, get_dataset_config_names
from tqdm import tqdm

OUT_JSONL = Path("datasets/reasoning-corpus.jsonl")
OUT_STATS = Path("datasets/reasoning-corpus.stats.json")


# ── MMLU subject → subDomain heuristic ─────────────────────────────────────
# 57 MMLU subjects roughly bucketed into verbal / logic / reasoning.
MMLU_VERBAL = {
    "high_school_european_history", "high_school_us_history", "high_school_world_history",
    "prehistory", "world_religions", "philosophy", "moral_disputes", "moral_scenarios",
    "jurisprudence", "international_law", "professional_law",
    "us_foreign_policy", "sociology", "human_sexuality", "global_facts",
    "high_school_government_and_politics", "high_school_geography",
    "high_school_psychology", "professional_psychology",
}
MMLU_LOGIC = {
    "formal_logic", "logical_fallacies", "abstract_algebra",
    "high_school_mathematics", "elementary_mathematics", "college_mathematics",
    "high_school_statistics",
}


def mmlu_subject_to_subdomain(subject: str) -> str:
    s = subject.lower()
    if s in MMLU_LOGIC:
        return "logic"
    if s in MMLU_VERBAL:
        return "verbal"
    return "reasoning"


# ── Extractors: each yields normalized dicts {problem, answer, solution, subDomain?} ──
def _serialize_choices(choices) -> str:
    if not choices:
        return ""
    return " | ".join(f"{chr(65 + i)}. {c}" for i, c in enumerate(choices))


def extract_mmlu(row, subject: str | None = None) -> dict | None:
    q = row.get("question")
    choices = row.get("choices") or []
    aidx = row.get("answer")
    if not q or aidx is None or not choices:
        return None
    try:
        aidx_i = int(aidx)
    except Exception:
        return None
    if aidx_i < 0 or aidx_i >= len(choices):
        return None
    problem = q + "\nOptions: " + _serialize_choices(choices)
    answer = chr(65 + aidx_i)
    sub = mmlu_subject_to_subdomain(subject or row.get("subject") or "")
    return {"problem": problem, "answer": answer, "solution": None, "subDomain": sub}


def extract_arc(row) -> dict | None:
    q = row.get("question")
    choices_obj = row.get("choices") or {}
    texts = choices_obj.get("text") or []
    labels = choices_obj.get("label") or []
    ans = row.get("answerKey")
    if not q or not texts or not ans:
        return None
    opts = " | ".join(f"{lab}. {txt}" for lab, txt in zip(labels, texts))
    problem = q + "\nOptions: " + opts
    return {"problem": problem, "answer": str(ans), "solution": None, "subDomain": "science-reasoning"}


def extract_boolq(row) -> dict | None:
    passage = row.get("passage")
    q = row.get("question")
    a = row.get("answer")
    if not passage or not q or a is None:
        return None
    problem = passage + "\nQuestion: " + q
    answer = "yes" if a else "no"
    return {"problem": problem, "answer": answer, "solution": None, "subDomain": "reading-comprehension"}


def extract_lambada(row) -> dict | None:
    text = row.get("text")
    if not text:
        return None
    parts = text.strip().rsplit(" ", 1)
    if len(parts) != 2:
        return None
    cloze, last = parts
    return {
        "problem": cloze + " ____",
        "answer": last,
        "solution": None,
        "subDomain": "language-modeling",
    }


# ── Source registry ───────────────────────────────────────────────────────
# Only INCLUDE=yes sources from LICENSES.md may appear here. Adding a non-include
# source fails loudly via _LICENSE_INCLUDE_OK guard below.
SOURCES: dict[str, dict] = {
    # MMLU has 57 subject configs plus 'all'. We pull every split of 'all'
    # (auxiliary_train ~99K + test ~14K + validation ~1.5K).
    "mmlu_aux": {
        "hf_id": "cais/mmlu",
        "config": "all",
        "split": "auxiliary_train",
        "license": "mit",
        "extractor": extract_mmlu,
    },
    "mmlu_test": {
        "hf_id": "cais/mmlu",
        "config": "all",
        "split": "test",
        "license": "mit",
        "extractor": extract_mmlu,
    },
    "mmlu_val": {
        "hf_id": "cais/mmlu",
        "config": "all",
        "split": "validation",
        "license": "mit",
        "extractor": extract_mmlu,
    },
    "ai2_arc_challenge_train": {
        "hf_id": "allenai/ai2_arc",
        "config": "ARC-Challenge",
        "split": "train",
        "license": "cc-by-sa-4.0",
        "extractor": extract_arc,
    },
    "ai2_arc_challenge_test": {
        "hf_id": "allenai/ai2_arc",
        "config": "ARC-Challenge",
        "split": "test",
        "license": "cc-by-sa-4.0",
        "extractor": extract_arc,
    },
    "ai2_arc_easy_train": {
        "hf_id": "allenai/ai2_arc",
        "config": "ARC-Easy",
        "split": "train",
        "license": "cc-by-sa-4.0",
        "extractor": extract_arc,
    },
    "ai2_arc_easy_test": {
        "hf_id": "allenai/ai2_arc",
        "config": "ARC-Easy",
        "split": "test",
        "license": "cc-by-sa-4.0",
        "extractor": extract_arc,
    },
    "boolq_train": {
        "hf_id": "google/boolq",
        "config": None,
        "split": "train",
        "license": "cc-by-sa-3.0",
        "extractor": extract_boolq,
    },
    "boolq_val": {
        "hf_id": "google/boolq",
        "config": None,
        "split": "validation",
        "license": "cc-by-sa-3.0",
        "extractor": extract_boolq,
    },
    "lambada_openai_en": {
        "hf_id": "EleutherAI/lambada_openai",
        "config": "en",
        "split": "test",
        "license": "mit",
        "extractor": extract_lambada,
    },
    "lambada_openai_de": {
        "hf_id": "EleutherAI/lambada_openai",
        "config": "de",
        "split": "test",
        "license": "mit",
        "extractor": extract_lambada,
    },
    "lambada_openai_es": {
        "hf_id": "EleutherAI/lambada_openai",
        "config": "es",
        "split": "test",
        "license": "mit",
        "extractor": extract_lambada,
    },
    "lambada_openai_fr": {
        "hf_id": "EleutherAI/lambada_openai",
        "config": "fr",
        "split": "test",
        "license": "mit",
        "extractor": extract_lambada,
    },
    "lambada_openai_it": {
        "hf_id": "EleutherAI/lambada_openai",
        "config": "it",
        "split": "test",
        "license": "mit",
        "extractor": extract_lambada,
    },
}

# Whitelist: any hf_id NOT in this set is rejected at startup (license gate).
_LICENSE_INCLUDE_OK = {
    "cais/mmlu",
    "allenai/ai2_arc",
    "google/boolq",
    "EleutherAI/lambada_openai",
}


def hf_url(hf_id: str) -> str:
    return f"https://huggingface.co/datasets/{hf_id}"


def iter_source(slug: str, spec: dict, limit: int) -> Iterable[dict]:
    """Yield normalized rows for one source. Skips on error."""
    hf_id = spec["hf_id"]
    cfg = spec["config"]
    split = spec["split"]
    license_str = spec["license"]
    extractor: Callable = spec["extractor"]
    url = hf_url(hf_id)

    try:
        if cfg:
            ds = load_dataset(hf_id, cfg, split=split, streaming=True)
        else:
            ds = load_dataset(hf_id, split=split, streaming=True)
    except Exception as e:
        print(f"[skip] {slug}: failed to open dataset: {e}", file=sys.stderr)
        return

    kept = 0
    idx = 0
    unknown_schema = 0
    pbar = tqdm(desc=slug, unit="row", total=limit if limit > 0 else None)
    try:
        for raw in ds:
            if limit > 0 and kept >= limit:
                break
            try:
                norm = extractor(raw)
            except Exception:
                norm = None
                unknown_schema += 1
            if norm is None:
                idx += 1
                continue
            problem = (norm.get("problem") or "").strip()
            answer = (norm.get("answer") or "").strip() if norm.get("answer") is not None else ""
            if len(problem) < 20 or not answer:
                idx += 1
                continue
            sub = norm.get("subDomain") or "reasoning"
            out = {
                "id": f"{slug}_{kept}",
                "problem": problem,
                "answer": answer,
                "solution": norm.get("solution"),
                "subject": "reasoning",
                "subDomain": sub,
                "source": hf_id,
                "license": license_str,
                "url": url,
            }
            yield out
            kept += 1
            idx += 1
            pbar.update(1)
        if unknown_schema:
            print(f"[warn] {slug}: {unknown_schema} rows failed extractor (schema surprise)", file=sys.stderr)
    except Exception as e:
        print(f"[warn] {slug}: stream error after {kept} rows: {e}", file=sys.stderr)
        traceback.print_exc()
    finally:
        pbar.close()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit-per-source", type=int, default=100_000)
    ap.add_argument(
        "--source-caps",
        type=str,
        default="",
        help="Per-source override caps as 'slug:N,slug:N'",
    )
    ap.add_argument(
        "--sources",
        type=str,
        default="",
        help="Comma-separated slugs to include (default: all)",
    )
    ap.add_argument("--out", type=str, default=str(OUT_JSONL))
    ap.add_argument("--stats", type=str, default=str(OUT_STATS))
    args = ap.parse_args()

    # License gate — any registered source must be on the INCLUDE=yes list.
    for slug, spec in SOURCES.items():
        if spec["hf_id"] not in _LICENSE_INCLUDE_OK:
            print(
                f"FATAL: source '{slug}' (hf_id={spec['hf_id']}) is not in the "
                f"INCLUDE=yes whitelist from LICENSES.md. Refusing to ingest.",
                file=sys.stderr,
            )
            return 3

    selected = (
        [s.strip() for s in args.sources.split(",") if s.strip()]
        if args.sources
        else list(SOURCES.keys())
    )
    unknown = [s for s in selected if s not in SOURCES]
    if unknown:
        print(f"Unknown sources: {unknown}", file=sys.stderr)
        return 2

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    overrides: dict[str, int] = {}
    if args.source_caps:
        for pair in args.source_caps.split(","):
            pair = pair.strip()
            if not pair:
                continue
            k, _, v = pair.partition(":")
            overrides[k.strip()] = int(v)

    stats: dict[str, dict] = {}
    total = 0
    skipped: list[str] = []

    # Overwrite (idempotent re-run)
    with out_path.open("w") as f:
        for slug in selected:
            spec = SOURCES[slug]
            cap = overrides.get(slug, args.limit_per_source)
            kept = 0
            try:
                for row in iter_source(slug, spec, cap):
                    f.write(json.dumps(row, ensure_ascii=False) + "\n")
                    kept += 1
            except Exception as e:
                print(f"[skip] {slug}: hard error: {e}", file=sys.stderr)
                skipped.append(f"{slug}: {e}")
            stats[slug] = {"rows": kept, "license": spec["license"], "hf_id": spec["hf_id"]}
            total += kept
            print(f"[done] {slug}: {kept} rows")

    stats["total"] = total
    if skipped:
        stats["skipped"] = skipped
    Path(args.stats).write_text(json.dumps(stats, indent=2))
    print(f"\nWrote {total} rows → {out_path}")
    print(f"Wrote stats → {args.stats}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
