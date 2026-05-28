"""
Evaluate all 4 trained models on the original 20 cat-pyq questions and
produce a comparison report.

Models:
  1. AutoGluon Tabular  (.autogluon-big-subdomain)       — subDomain prediction
  2. AutoGluon MultiModal (.autogluon-mm-subdomain)      — subDomain prediction
  3. Sentence-transformer + FAISS (.st-retriever)        — answer via retrieval
  4. FLAN-T5-small fine-tuned (.flan-t5-answer)          — answer generation

Run:
    source ~/autogluon-env/bin/activate
    python scripts/evaluate_all.py
"""

from __future__ import annotations

import json
import pickle
import sys
import time
import types
from pathlib import Path

# Stub nvidia_smi so AutoGluon MultiModal can load on macOS without NVML
fake = types.ModuleType("nvidia_smi")
fake.nvmlInit                   = lambda: None
fake.nvmlShutdown               = lambda: None
fake.nvmlDeviceGetCount         = lambda: 0
fake.nvmlDeviceGetHandleByIndex = lambda i: None
class _MemInfo:
    total = free = used = 0
fake.nvmlDeviceGetMemoryInfo    = lambda h: _MemInfo()
sys.modules["nvidia_smi"]       = fake

import pandas as pd

ROWS = [json.loads(l) for l in open("datasets/cat-pyq.jsonl")]
df   = pd.DataFrame(ROWS)
print(f"Evaluating on {len(df)} original cat-pyq questions\n")

results = pd.DataFrame({
    "id":        df["id"],
    "problem":   df["problem"].str[:60] + "…",
    "subDomain": df["subDomain"],
    "answer":    df["answer"],
})

# ── 1. AutoGluon Tabular ───────────────────────────────────────────────────
try:
    from autogluon.tabular import TabularPredictor
    print("[1/4] AutoGluon Tabular subDomain...")
    t0 = time.time()
    p = TabularPredictor.load(".autogluon-big-subdomain", verbosity=0)
    preds = p.predict(df[["problem"]]).values
    results["tabular_subDomain"] = preds
    results["tabular_ok"] = results["tabular_subDomain"] == results["subDomain"]
    print(f"   accuracy: {results['tabular_ok'].mean():.0%}  ({time.time()-t0:.1f}s)")
except Exception as e:
    print(f"   FAILED: {e}")

# ── 2. AutoGluon MultiModal ────────────────────────────────────────────────
try:
    from autogluon.multimodal import MultiModalPredictor
    print("\n[2/4] AutoGluon MultiModal subDomain...")
    t0 = time.time()
    p = MultiModalPredictor.load(".autogluon-mm-subdomain")
    preds = p.predict(df[["problem"]]).values
    results["mm_subDomain"] = preds
    results["mm_ok"] = results["mm_subDomain"] == results["subDomain"]
    print(f"   accuracy: {results['mm_ok'].mean():.0%}  ({time.time()-t0:.1f}s)")
except Exception as e:
    print(f"   FAILED: {e}")

# ── 3. Sentence-transformer retriever ──────────────────────────────────────
try:
    import faiss
    import numpy as np
    from sentence_transformers import SentenceTransformer
    print("\n[3/4] Sentence-transformer + FAISS retriever...")
    t0 = time.time()
    model = SentenceTransformer(".st-retriever/model")
    index = faiss.read_index(".st-retriever/faiss.index")
    meta  = pickle.load(open(".st-retriever/meta.pkl", "rb"))

    q_embs = model.encode(df["problem"].tolist(), normalize_embeddings=True).astype("float32")
    D, I   = index.search(q_embs, k=1)
    retrieved_ans = [meta["answers"][i]    for i in I[:, 0]]
    retrieved_sub = [meta["subdomains"][i] for i in I[:, 0]]
    results["retriever_answer"]    = retrieved_ans
    results["retriever_subDomain"] = retrieved_sub
    results["retriever_ans_ok"]    = results["retriever_answer"]    == results["answer"]
    results["retriever_sub_ok"]    = results["retriever_subDomain"] == results["subDomain"]
    print(f"   answer accuracy: {results['retriever_ans_ok'].mean():.0%}")
    print(f"   subDom accuracy: {results['retriever_sub_ok'].mean():.0%}  ({time.time()-t0:.1f}s)")
except Exception as e:
    print(f"   FAILED: {e}")

# ── 4. FLAN-T5 ─────────────────────────────────────────────────────────────
try:
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
    print("\n[4/4] FLAN-T5-small fine-tuned...")
    t0 = time.time()
    import torch
    device = "cpu"   # safest on macOS — avoid MPS placeholder errors
    tok   = AutoTokenizer.from_pretrained(".flan-t5-answer")
    model = AutoModelForSeq2SeqLM.from_pretrained(".flan-t5-answer").to(device)
    model.eval()
    preds = []
    for q in df["problem"]:
        inp = tok(f"Solve: {q}", return_tensors="pt", truncation=True, max_length=256).to(device)
        with torch.no_grad():
            out = model.generate(**inp, max_new_tokens=16)
        preds.append(tok.decode(out[0], skip_special_tokens=True).strip())
    results["flan_t5_answer"] = preds
    results["flan_t5_ok"]     = results["flan_t5_answer"] == results["answer"]
    print(f"   answer accuracy: {results['flan_t5_ok'].mean():.0%}  ({time.time()-t0:.1f}s)")
except Exception as e:
    print(f"   FAILED: {e}")

# ── Final report ───────────────────────────────────────────────────────────
print("\n" + "═" * 70)
print("  FINAL COMPARISON")
print("═" * 70)

summary = []
if "tabular_ok" in results:
    summary.append(("AutoGluon Tabular",   "subDomain", f"{results['tabular_ok'].mean():.0%}"))
if "mm_ok" in results:
    summary.append(("AutoGluon MultiModal","subDomain", f"{results['mm_ok'].mean():.0%}"))
if "retriever_ans_ok" in results:
    summary.append(("ST retriever",        "answer",    f"{results['retriever_ans_ok'].mean():.0%}"))
    summary.append(("ST retriever",        "subDomain", f"{results['retriever_sub_ok'].mean():.0%}"))
if "flan_t5_ok" in results:
    summary.append(("FLAN-T5-small (FT)",  "answer",    f"{results['flan_t5_ok'].mean():.0%}"))

summary_df = pd.DataFrame(summary, columns=["model", "target", "accuracy"])
print(summary_df.to_string(index=False))

# Detail table
print("\n── Per-question results ──")
print(results.drop(columns=["problem"]).to_string(index=False))

# Save
results.to_csv("datasets/evaluation_results.csv", index=False)
print("\nSaved → datasets/evaluation_results.csv")
