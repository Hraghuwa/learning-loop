"""
Download GSM8K + AQuA-RAT, label them with domain/subDomain heuristics,
merge with the existing cat-pyq.jsonl, and write datasets/combined-qa.jsonl.

Run:
    source ~/autogluon-env/bin/activate
    python scripts/build_combined_dataset.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd
from datasets import load_dataset

OUT = Path("datasets/combined-qa.jsonl")

# ── 1. GSM8K (grade-school math word problems) ─────────────────────────────
print("Downloading GSM8K...")
gsm = load_dataset("gsm8k", "main", split="train")  # 7473 rows
gsm_rows = []
for i, row in enumerate(gsm):
    # Final answer follows '#### ' in the solution
    ans = row["answer"].split("####")[-1].strip().replace(",", "")
    gsm_rows.append({
        "id":        f"GSM{i}",
        "domain":    "arithmetic",
        "subDomain": "word-problem",
        "problem":   row["question"],
        "answer":    ans,
        "source":    "gsm8k",
    })
print(f"  GSM8K rows: {len(gsm_rows)}")

# ── 2. AQuA-RAT (algebra MCQ) ──────────────────────────────────────────────
print("Downloading AQuA-RAT...")
aqua = load_dataset("deepmind/aqua_rat", "raw", split="train")  # ~97K
# Sample 3K for speed
aqua = aqua.shuffle(seed=42).select(range(3000))
aqua_rows = []
for i, row in enumerate(aqua):
    aqua_rows.append({
        "id":        f"AQ{i}",
        "domain":    "arithmetic",
        "subDomain": "algebra-mcq",
        "problem":   row["question"] + " Options: " + " | ".join(row["options"]),
        "answer":    row["correct"],         # A/B/C/D/E
        "source":    "aqua-rat",
    })
print(f"  AQuA rows: {len(aqua_rows)}")

# ── 3. Logic / verbal supplements via simple heuristic categories ──────────
# Add a small synthetic logic+verbal slice from GSM8K-ish patterns so the model
# sees some non-arithmetic. We'll re-label rows whose question matches keywords.
def relabel(row):
    q = row["problem"].lower()
    if any(k in q for k in ["synonym", "antonym", "meaning of", "spell"]):
        row["domain"]    = "verbal"
        row["subDomain"] = "vocabulary"
    elif any(k in q for k in ["series:", "next number", "odd one out",
                              "blood relation", "code", "encoded"]):
        row["domain"]    = "logic"
        row["subDomain"] = "reasoning"
    return row

# ── 4. Original cat-pyq ────────────────────────────────────────────────────
print("Loading cat-pyq.jsonl...")
cat_rows = [json.loads(l) for l in open("datasets/cat-pyq.jsonl")]
print(f"  cat-pyq rows: {len(cat_rows)}")

# ── 5. Merge + de-dup + clean ──────────────────────────────────────────────
all_rows = gsm_rows + aqua_rows + cat_rows
all_rows = [relabel(r) for r in all_rows]

df = pd.DataFrame(all_rows)
df = df.dropna(subset=["problem", "answer"])
df["problem"] = df["problem"].str.replace(r"\s+", " ", regex=True).str.strip()
df["answer"]  = df["answer"].astype(str).str.strip()
df = df.drop_duplicates(subset=["problem"])
df = df[df["problem"].str.len() > 10]
print(f"\nFinal combined rows: {len(df)}")
print("Domain distribution:")
print(df["domain"].value_counts().to_string())
print("\nSubDomain top 10:")
print(df["subDomain"].value_counts().head(10).to_string())

# ── 6. Write out ──────────────────────────────────────────────────────────
OUT.parent.mkdir(parents=True, exist_ok=True)
with OUT.open("w") as f:
    for _, r in df.iterrows():
        f.write(json.dumps(r.to_dict()) + "\n")
print(f"\nSaved → {OUT}")
