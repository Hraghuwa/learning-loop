"""
Ingest math/quant datasets approved (INCLUDE=yes) in LICENSES.md into a single
normalized JSONL at datasets/math-corpus.jsonl. Every row carries its source +
license for downstream citation in Phase 8.

Run:
    source ~/autogluon-env/bin/activate
    python scripts/ingest_math.py                       # full run, 200K/source cap
    python scripts/ingest_math.py --limit-per-source 50 # smoke test
    python scripts/ingest_math.py --sources gsm8k,math_qa
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import traceback
from pathlib import Path
from typing import Callable, Iterable

from datasets import load_dataset
from tqdm import tqdm

OUT_JSONL = Path("datasets/math-corpus.jsonl")
OUT_STATS = Path("datasets/math-corpus.stats.json")


# ── Heuristic sub-domain tagger ────────────────────────────────────────────
ALGEBRA_RX = re.compile(
    r"\b(equation|polynomial|solve for|variable|inequality|quadratic|linear|x\s*=)\b",
    re.I,
)
GEOMETRY_RX = re.compile(
    r"\b(triangle|circle|square|rectangle|polygon|angle|radius|diameter|perimeter|area|volume|cube|sphere|cylinder|geometry)\b",
    re.I,
)
WORD_RX = re.compile(
    r"\b(how many|how much|total|each|together|altogether|sells|bought|distance|speed|time|hour|minute|age|years old)\b",
    re.I,
)
ARITH_RX = re.compile(r"\b(sum|product|difference|quotient|add|subtract|multiply|divide|percent|fraction|ratio)\b", re.I)


def tag_subdomain(text: str) -> str:
    if GEOMETRY_RX.search(text):
        return "geometry"
    if ALGEBRA_RX.search(text):
        return "algebra"
    if WORD_RX.search(text):
        return "word-problem"
    if ARITH_RX.search(text):
        return "arithmetic"
    return "other"


# ── Extractors: each yields normalized dicts {problem, answer, solution} ──
def extract_open_math_instruct_2(row) -> dict | None:
    p = row.get("problem") or row.get("question")
    a = row.get("expected_answer") or row.get("answer")
    s = row.get("generated_solution") or row.get("solution")
    if not p or not a:
        return None
    return {"problem": p, "answer": str(a), "solution": s}


def extract_competition_math(row) -> dict | None:
    p = row.get("problem")
    sol = row.get("solution")
    if not p or not sol:
        return None
    # Final answer is inside \boxed{...}
    m = re.search(r"\\boxed\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}", sol)
    ans = m.group(1).strip() if m else sol.strip().splitlines()[-1][:200]
    return {"problem": p, "answer": ans, "solution": sol}


def extract_gsm8k(row) -> dict | None:
    p = row.get("question")
    full = row.get("answer")
    if not p or not full:
        return None
    parts = full.split("####")
    ans = parts[-1].strip().replace(",", "") if len(parts) > 1 else ""
    if not ans:
        return None
    return {"problem": p, "answer": ans, "solution": full}


def extract_aqua_rat(row) -> dict | None:
    p = row.get("question")
    opts = row.get("options") or []
    ans = row.get("correct")
    sol = row.get("rationale")
    if not p or not ans:
        return None
    full_problem = p + " Options: " + " | ".join(opts) if opts else p
    return {"problem": full_problem, "answer": str(ans), "solution": sol}


def extract_math_qa(row) -> dict | None:
    p = row.get("Problem") or row.get("problem")
    ans = row.get("correct") or row.get("answer")
    sol = row.get("Rationale") or row.get("rationale")
    if not p or not ans:
        return None
    return {"problem": p, "answer": str(ans), "solution": sol}


def extract_orca_math(row) -> dict | None:
    p = row.get("question")
    a = row.get("answer")
    if not p or not a:
        return None
    return {"problem": p, "answer": str(a), "solution": None}


def extract_math_instruct(row) -> dict | None:
    # TIGER-Lab/MathInstruct: fields 'instruction', 'output', sometimes 'input'
    p = row.get("instruction") or row.get("question") or row.get("problem")
    ans = row.get("output") or row.get("answer")
    extra = row.get("input")
    if not p or not ans:
        return None
    if extra:
        p = f"{p}\n{extra}"
    # Try to extract a boxed final answer if present
    m = re.search(r"\\boxed\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}", str(ans))
    final = m.group(1).strip() if m else str(ans).strip().splitlines()[-1][:200]
    return {"problem": p, "answer": final or str(ans)[:200], "solution": str(ans)}


# ── Source registry ───────────────────────────────────────────────────────
# slug -> (hf_id, config, split, license, extractor)
SOURCES: dict[str, dict] = {
    "OpenMathInstruct-2": {
        "hf_id": "nvidia/OpenMathInstruct-2",
        "config": None,
        "split": "train",
        "license": "cc-by-4.0",
        "extractor": extract_open_math_instruct_2,
    },
    "competition_math": {
        # Original 'hendrycks/competition_math' was removed from the Hub.
        # 'qwedsacf/competition_math' is a faithful mirror with the same
        # schema {problem, level, type, solution}; the underlying MATH
        # benchmark is MIT-licensed (Hendrycks et al., 2021).
        "hf_id": "qwedsacf/competition_math",
        "config": None,
        "split": "train",
        "license": "mit",
        "extractor": extract_competition_math,
    },
    "gsm8k": {
        "hf_id": "openai/gsm8k",
        "config": "main",
        "split": "train",
        "license": "mit",
        "extractor": extract_gsm8k,
    },
    "aqua_rat": {
        "hf_id": "deepmind/aqua_rat",
        "config": "raw",
        "split": "train",
        "license": "apache-2.0",
        "extractor": extract_aqua_rat,
    },
    # NOTE: "allenai/math_qa" disabled — HF no longer supports its loading
    # script ("Dataset scripts are no longer supported"). No clean apache-2.0
    # mirror with the original {Problem, correct, Rationale} schema was found.
    # Re-enable here if a parquet mirror appears.
    "orca-math-word-problems-200k": {
        "hf_id": "microsoft/orca-math-word-problems-200k",
        "config": None,
        "split": "train",
        "license": "mit",
        "extractor": extract_orca_math,
    },
    "MathInstruct": {
        "hf_id": "TIGER-Lab/MathInstruct",
        "config": None,
        "split": "train",
        "license": "mit",
        "extractor": extract_math_instruct,
    },
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
    pbar = tqdm(desc=slug, unit="row", total=limit if limit > 0 else None)
    try:
        for raw in ds:
            if limit > 0 and kept >= limit:
                break
            try:
                norm = extractor(raw)
            except Exception:
                norm = None
            if norm is None:
                idx += 1
                continue
            problem = (norm.get("problem") or "").strip()
            answer = (norm.get("answer") or "").strip() if norm.get("answer") is not None else ""
            if len(problem) < 20 or not answer:
                idx += 1
                continue
            out = {
                "id": f"{slug}_{kept}",
                "problem": problem,
                "answer": answer,
                "solution": norm.get("solution"),
                "subject": "math",
                "subDomain": tag_subdomain(problem),
                "source": hf_id,
                "license": license_str,
                "url": url,
            }
            yield out
            kept += 1
            idx += 1
            pbar.update(1)
    except Exception as e:
        print(f"[warn] {slug}: stream error after {kept} rows: {e}", file=sys.stderr)
        traceback.print_exc()
    finally:
        pbar.close()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit-per-source", type=int, default=200_000)
    ap.add_argument(
        "--source-caps",
        type=str,
        default="",
        help="Per-source override caps as 'slug:N,slug:N' (e.g. OpenMathInstruct-2:20000)",
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

    # Overwrite (idempotent re-run)
    with out_path.open("w") as f:
        for slug in selected:
            spec = SOURCES[slug]
            cap = overrides.get(slug, args.limit_per_source)
            kept = 0
            for row in iter_source(slug, spec, cap):
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
                kept += 1
            stats[slug] = {"rows": kept, "license": spec["license"], "hf_id": spec["hf_id"]}
            total += kept
            print(f"[done] {slug}: {kept} rows")

    stats["total"] = total
    Path(args.stats).write_text(json.dumps(stats, indent=2))
    print(f"\nWrote {total} rows → {out_path}")
    print(f"Wrote stats → {args.stats}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
