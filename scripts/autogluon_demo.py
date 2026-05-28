"""
AutoGluon Tabular demo.

Run from the repo root:

    source ~/autogluon-env/bin/activate
    python scripts/autogluon_demo.py

The venv was created with:
    uv venv ~/autogluon-env --python 3.12
    uv pip install autogluon "setuptools<81"
(setuptools must be <81 because newer versions drop `pkg_resources`,
which autogluon.multimodal still imports.)
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

import pandas as pd
from autogluon.tabular import TabularDataset, TabularPredictor


def main() -> int:
    # Toy dataset: AutoGluon hosts the classic "knot_theory" tabular sample.
    train_url = "https://autogluon.s3.amazonaws.com/datasets/Inc/train.csv"
    test_url = "https://autogluon.s3.amazonaws.com/datasets/Inc/test.csv"

    print(f"[autogluon] python={sys.version.split()[0]}")
    print("[autogluon] loading sample data (adult-income)...")
    train_data = TabularDataset(train_url).sample(n=500, random_state=0)
    test_data = TabularDataset(test_url).sample(n=200, random_state=0)
    label = "class"

    out_dir = Path(__file__).resolve().parent.parent / ".autogluon-demo"
    if out_dir.exists():
        shutil.rmtree(out_dir)

    print(f"[autogluon] training (output → {out_dir})...")
    predictor = TabularPredictor(label=label, path=str(out_dir)).fit(
        train_data,
        time_limit=60,           # seconds
        presets="medium_quality",
    )

    print("[autogluon] evaluating on holdout...")
    perf = predictor.evaluate(test_data, silent=True)
    print(f"[autogluon] holdout metrics: {perf}")

    print("[autogluon] leaderboard:")
    lb = predictor.leaderboard(test_data, silent=True)
    print(lb.to_string(index=False))

    preds = predictor.predict(test_data.drop(columns=[label]).head(5))
    print("[autogluon] sample predictions:")
    print(pd.DataFrame({"pred": preds.values, "actual": test_data[label].head(5).values}))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
