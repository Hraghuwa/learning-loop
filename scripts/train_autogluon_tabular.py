"""
Train AutoGluon TabularPredictor on combined-qa.jsonl to predict subDomain
from the problem text.

Run:
    source ~/autogluon-env/bin/activate
    python scripts/train_autogluon_tabular.py
"""

from __future__ import annotations

import json
import shutil
import time
from pathlib import Path

import pandas as pd
from autogluon.tabular import TabularPredictor

print("Loading combined dataset...")
rows = [json.loads(l) for l in open("datasets/combined-qa.jsonl")]
df   = pd.DataFrame(rows)[["problem", "subDomain"]]
print(f"Total: {len(df)} rows | classes: {df['subDomain'].nunique()}")
print(df["subDomain"].value_counts().head().to_string())

# Hold out 10% for evaluation
df = df.sample(frac=1.0, random_state=0).reset_index(drop=True)
n_holdout = int(0.10 * len(df))
test_df, train_df = df.iloc[:n_holdout].copy(), df.iloc[n_holdout:].copy()
print(f"\nTrain: {len(train_df)} | Holdout: {len(test_df)}")

out = Path(".autogluon-big-subdomain")
if out.exists():
    shutil.rmtree(out)

print("\nFitting AutoGluon Tabular (time_limit=300s)...")
t0 = time.time()
predictor = TabularPredictor(
    label="subDomain",
    path=str(out),
    eval_metric="accuracy",
).fit(
    train_df,
    time_limit=300,
    presets="medium_quality",
    verbosity=2,
)
print(f"\nFit took {time.time()-t0:.1f}s")

print("\nLeaderboard:")
lb = predictor.leaderboard(test_df, silent=True)
print(lb[["model", "score_test", "eval_metric", "pred_time_test", "fit_time"]].to_string(index=False))

print("\nBest model holdout accuracy:")
best = lb.iloc[0]["model"]
print(f"  {best}: {lb.iloc[0]['score_test']:.4f}")
