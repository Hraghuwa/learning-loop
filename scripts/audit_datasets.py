"""
Audit candidate open educational datasets for Phase 5.

For each entry in CANDIDATES, query the HuggingFace Hub for license + row count
and emit a markdown table row. Output is markdown to stdout.

Run:
    source ~/autogluon-env/bin/activate
    python scripts/audit_datasets.py
"""

from __future__ import annotations

import sys
import traceback
from typing import Optional

from huggingface_hub import dataset_info
from huggingface_hub.utils import HfHubHTTPError

# (hf_id, content_type, notes)
CANDIDATES: list[tuple[str, str, str]] = [
    # --- Math ---
    ("nvidia/OpenMathInstruct-2",            "Q&A (math)",      "math instruction"),
    ("hendrycks/competition_math",           "Q&A (math)",      "competition MATH"),
    ("openai/gsm8k",                         "Q&A (math)",      "grade school"),
    ("deepmind/aqua_rat",                    "Q&A (math)",      "algebra MCQ"),
    ("allenai/math_qa",                      "Q&A (math)",      "math QA"),
    ("microsoft/orca-math-word-problems-200k","Q&A (math)",     "word problems"),
    # --- Reasoning / verbal ---
    ("cais/mmlu",                            "Q&A (reasoning)", "multi-subject MCQ"),
    ("allenai/ai2_arc",                      "Q&A (reasoning)", "science MCQ"),
    ("google/boolq",                         "Q&A (reasoning)", "yes/no QA"),
    ("lukaemon/bbh",                         "Q&A (reasoning)", "Big-Bench Hard"),
    ("EleutherAI/lambada_openai",            "Q&A (reasoning)", "language modeling"),
    # --- Long-form CC ---
    ("nampdn-ai/tiny-textbooks",             "textbook",        "synthetic textbooks"),
    ("nvidia/HelpSteer",                     "Q&A (instruct)",  "RLHF preference"),
    # OpenStax community dataset (try a known mirror)
    ("MohamedRashad/openstax-textbooks",     "textbook",        "OpenStax mirror"),
    # Extras to broaden coverage
    ("TIGER-Lab/MathInstruct",               "Q&A (math)",      "math instruction"),
    ("allenai/sciq",                         "Q&A (reasoning)", "science MCQ"),
    ("allenai/openbookqa",                   "Q&A (reasoning)", "open book QA"),
]


COMMERCIAL_OK_TOKENS = {
    "mit", "apache-2.0", "apache", "bsd", "bsd-3-clause", "bsd-2-clause",
    "cc0-1.0", "cc0", "cc-by-4.0", "cc-by-3.0", "cc-by-2.0", "cc-by-2.5",
    "cc-by-sa-4.0", "cc-by-sa-3.0", "odc-by", "public-domain", "pddl",
    "wtfpl", "unlicense", "isc",
}
COMMERCIAL_NO_TOKENS = {
    "cc-by-nc-4.0", "cc-by-nc-3.0", "cc-by-nc-sa-4.0", "cc-by-nc-sa-3.0",
    "cc-by-nc-nd-4.0", "cc-by-nc", "gpl-3.0", "gpl-2.0", "agpl-3.0",
    "lgpl-3.0", "creativeml-openrail-m",
}


def commercial_flag(license_str: Optional[str]) -> str:
    if not license_str:
        return "unknown"
    s = license_str.strip().lower()
    if s in COMMERCIAL_OK_TOKENS:
        return "yes"
    if s in COMMERCIAL_NO_TOKENS:
        return "no"
    if s in ("other", "unknown", "unlicense"):
        # unlicense itself is permissive, but HF "other"/"unknown" needs review
        if s == "unlicense":
            return "yes"
        return "unknown"
    if s.startswith("cc-by-nc"):
        return "no"
    if s.startswith("cc-by"):
        return "yes"
    if s.startswith("apache") or s.startswith("mit") or s.startswith("bsd"):
        return "yes"
    return "unknown"


def extract_license(info) -> Optional[str]:
    # license can live in card_data or top-level tags
    cd = getattr(info, "card_data", None)
    if cd is not None:
        try:
            lic = cd.get("license") if hasattr(cd, "get") else getattr(cd, "license", None)
        except Exception:
            lic = None
        if lic:
            if isinstance(lic, list):
                return ",".join(str(x) for x in lic)
            return str(lic)
    # fallback: tags like "license:cc-by-4.0"
    for t in (info.tags or []):
        if t.startswith("license:"):
            return t.split(":", 1)[1]
    return None


def extract_rows(info) -> Optional[int]:
    """Sum rows across all splits/configs from dataset_info."""
    total = 0
    found = False
    # Newer datasets-server style
    ci = getattr(info, "card_data", None)
    if ci is not None:
        try:
            dataset_info_block = ci.get("dataset_info") if hasattr(ci, "get") else None
        except Exception:
            dataset_info_block = None
        if dataset_info_block:
            blocks = dataset_info_block if isinstance(dataset_info_block, list) else [dataset_info_block]
            for blk in blocks:
                splits = blk.get("splits") if isinstance(blk, dict) else None
                if splits:
                    for sp in splits:
                        n = sp.get("num_examples") if isinstance(sp, dict) else None
                        if isinstance(n, int):
                            total += n
                            found = True
    if found:
        return total
    # Fallback: siblings file sizes won't give row counts; return None
    return None


def humanize(n: Optional[int]) -> str:
    if n is None:
        return "?"
    if n >= 1_000_000:
        return f"~{n/1_000_000:.1f}M"
    if n >= 1_000:
        return f"~{n/1_000:.0f}K"
    return str(n)


def main() -> int:
    print("| Dataset | License | Rows | Content type | Commercial | Notes |")
    print("|---|---|---|---|---|---|")
    resolved = 0
    for hf_id, ctype, notes in CANDIDATES:
        try:
            info = dataset_info(hf_id)
            lic = extract_license(info) or "unknown"
            rows = extract_rows(info)
            flag = commercial_flag(lic)
            if lic != "unknown":
                resolved += 1
            print(f"| `{hf_id}` | {lic} | {humanize(rows)} | {ctype} | {flag} | {notes} |")
        except HfHubHTTPError as e:
            print(f"| `{hf_id}` | TODO (HTTP {e.response.status_code if e.response else '?'}) | ? | {ctype} | unknown | {notes} — manual check |", file=sys.stdout)
        except Exception as e:  # noqa: BLE001
            print(f"| `{hf_id}` | TODO ({type(e).__name__}) | ? | {ctype} | unknown | {notes} — manual check |", file=sys.stdout)
            print(f"# error for {hf_id}: {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
    print(f"\n<!-- Resolved {resolved}/{len(CANDIDATES)} candidates from HF metadata. -->")
    return 0


if __name__ == "__main__":
    sys.exit(main())
