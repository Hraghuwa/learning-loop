"""
Apply the 3 trained AutoGluon models to cat-pyq.jsonl.

Loads:
  .autogluon-cat-domain    → predicts domain
  .autogluon-cat-subdomain → predicts subDomain
  .autogluon-cat-answer    → predicts answer

Outputs:
  datasets/cat-pyq-predictions.jsonl  — original rows + all 3 predictions

Run:
    source ~/autogluon-env/bin/activate
    python scripts/autogluon_apply.py
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
from autogluon.tabular import TabularPredictor

# ── Load data ──────────────────────────────────────────────────────────────
JSONL   = Path("datasets/cat-pyq.jsonl")
rows    = [json.loads(l) for l in JSONL.open()]
df      = pd.DataFrame(rows)
features = df[["problem", "domain", "subDomain", "answer"]]

# ── Load models ────────────────────────────────────────────────────────────
print("Loading models...")
p_domain    = TabularPredictor.load(".autogluon-cat-domain",    verbosity=0)
p_subdomain = TabularPredictor.load(".autogluon-cat-subdomain", verbosity=0)
p_answer    = TabularPredictor.load(".autogluon-cat-answer",    verbosity=0)

# ── Run inference (each model sees all columns except its own label) ────────
print("Running inference...")
df["pred_domain"]    = p_domain.predict(features.drop(columns=["domain"])).values
df["pred_subDomain"] = p_subdomain.predict(features.drop(columns=["subDomain"])).values
df["pred_answer"]    = p_answer.predict(features.drop(columns=["answer"])).values

# ── Accuracy summary ───────────────────────────────────────────────────────
acc_domain    = (df["pred_domain"]    == df["domain"]).mean()
acc_subdomain = (df["pred_subDomain"] == df["subDomain"]).mean()
acc_answer    = (df["pred_answer"]    == df["answer"]).mean()

print(f"\n{'─'*50}")
print(f"  domain    accuracy : {acc_domain:.0%}")
print(f"  subDomain accuracy : {acc_subdomain:.0%}")
print(f"  answer    accuracy : {acc_answer:.0%}")
print(f"{'─'*50}\n")

# ── Pretty table ───────────────────────────────────────────────────────────
display = df[[
    "id", "problem",
    "domain",    "pred_domain",
    "subDomain", "pred_subDomain",
    "answer",    "pred_answer",
]].copy()

display["dom_ok"] = display["domain"]    == display["pred_domain"]
display["sub_ok"] = display["subDomain"] == display["pred_subDomain"]
display["ans_ok"] = display["answer"]    == display["pred_answer"]

print(display[[
    "id",
    "pred_domain",    "dom_ok",
    "pred_subDomain", "sub_ok",
    "pred_answer",    "ans_ok",
]].to_string(index=False))

# ── Save results ───────────────────────────────────────────────────────────
out_path = Path("datasets/cat-pyq-predictions.jsonl")
with out_path.open("w") as f:
    for _, row in df.iterrows():
        f.write(json.dumps(row.to_dict()) + "\n")

print(f"\nSaved → {out_path}")
