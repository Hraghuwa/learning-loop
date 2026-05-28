"""
AutoGluon on datasets/cat-pyq.jsonl
Trains 3 separate TabularPredictors:
  1. Predict domain      (arithmetic / logic / verbal)
  2. Predict subDomain   (~10 classes)
  3. Predict answer      (free-text regression/classification)

NOTE: Only 20 rows — results are illustrative, not production-grade.

Run:
    source ~/autogluon-env/bin/activate
    python scripts/autogluon_cat_pyq.py
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pandas as pd
from autogluon.tabular import TabularPredictor

# ── Load data ──────────────────────────────────────────────────────────────
JSONL = Path("datasets/cat-pyq.jsonl")
rows = [json.loads(l) for l in JSONL.open()]
df = pd.DataFrame(rows)[["problem", "domain", "subDomain", "answer"]]
print(f"Dataset: {len(df)} rows\n{df['domain'].value_counts().to_string()}\n")

# ── Helper ─────────────────────────────────────────────────────────────────
def run(label: str, out_name: str) -> None:
    print(f"\n{'='*60}")
    print(f"  TARGET: {label}")
    print(f"{'='*60}")

    out_dir = Path(f".autogluon-cat-{out_name}")
    if out_dir.exists():
        shutil.rmtree(out_dir)

    # With 20 rows use all data for training; evaluate on same data (demo only)
    predictor = TabularPredictor(
        label=label,
        path=str(out_dir),
        verbosity=0,
    ).fit(
        df,
        time_limit=30,
        presets="medium_quality",
        # holdout_frac requires ≥10 val rows; with 20 rows skip holdout
        num_bag_folds=0,
        num_stack_levels=0,
    )

    lb = predictor.leaderboard(df, silent=True)
    print("\nLeaderboard:")
    print(lb[["model", "score_test", "eval_metric"]].to_string(index=False))

    preds = predictor.predict(df.drop(columns=[label]))
    result = pd.DataFrame({
        "problem":    df["problem"].str[:55] + "…",
        "predicted":  preds.values,
        "actual":     df[label].values,
    })
    result["✓"] = result["predicted"] == result["actual"]
    print(f"\nPredictions (accuracy={result['✓'].mean():.0%}):")
    print(result.to_string(index=False))


# ── Run all three ──────────────────────────────────────────────────────────
run("domain",    "domain")
run("subDomain", "subdomain")
run("answer",    "answer")
