"""
Train AutoGluon MultiModalPredictor (BERT backbone) on combined-qa.jsonl
to predict subDomain.

Run:
    source ~/autogluon-env/bin/activate
    python scripts/train_multimodal.py
"""

from __future__ import annotations

import json
import shutil
import sys
import time
import types
from pathlib import Path

# ── Monkey-patch nvidia_smi BEFORE autogluon imports it ────────────────────
# AutoGluon MultiModal unconditionally calls nvidia_smi.nvmlInit() to log GPU
# info, which crashes on macOS (no NVML lib). We inject a stub so it no-ops.
fake = types.ModuleType("nvidia_smi")
fake.nvmlInit                   = lambda: None
fake.nvmlShutdown               = lambda: None
fake.nvmlDeviceGetCount         = lambda: 0
fake.nvmlDeviceGetHandleByIndex = lambda i: None
class _MemInfo:
    total = free = used = 0
fake.nvmlDeviceGetMemoryInfo    = lambda h: _MemInfo()
sys.modules["nvidia_smi"]       = fake

import os
# Limit threads / disable multiprocessing for stability on macOS
os.environ.setdefault("KMP_DUPLICATE_LIB_OK",  "TRUE")
os.environ.setdefault("OMP_NUM_THREADS",       "2")
os.environ.setdefault("TOKENIZERS_PARALLELISM","false")

import torch
torch.set_num_threads(2)

import pandas as pd
from autogluon.multimodal import MultiModalPredictor

print("Loading combined dataset...")
rows = [json.loads(l) for l in open("datasets/combined-qa.jsonl")]
df   = pd.DataFrame(rows)[["problem", "subDomain"]]

# Sample 1.5K rows for CPU-friendly training
df = df.sample(n=min(1500, len(df)), random_state=0).reset_index(drop=True)
n_holdout = int(0.10 * len(df))
test_df, train_df = df.iloc[:n_holdout].copy(), df.iloc[n_holdout:].copy()
print(f"Train: {len(train_df)} | Holdout: {len(test_df)}")

out = Path(".autogluon-mm-subdomain")
if out.exists():
    shutil.rmtree(out)

print("\nFitting MultiModalPredictor (DeBERTa/Electra backbone)...")
t0 = time.time()

predictor = MultiModalPredictor(
    label="subDomain",
    path=str(out),
    eval_metric="accuracy",
    problem_type="multiclass",
)

predictor.fit(
    train_df,
    time_limit=600,                   # 10 min cap
    presets="medium_quality",
    hyperparameters={
        "env.num_gpus": 0,                    # force CPU on macOS
        "env.num_workers": 0,                 # avoid multiprocessing crashes
        "env.per_gpu_batch_size": 4,          # smaller batch on CPU
        "model.hf_text.checkpoint_name": "google/electra-small-discriminator",
    },
)
print(f"\nFit took {time.time()-t0:.1f}s")

print("\nEvaluating on holdout...")
score = predictor.evaluate(test_df)
print(f"Holdout accuracy: {score}")
