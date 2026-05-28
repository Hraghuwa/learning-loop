"""
Build a sentence-transformer + FAISS retriever over all questions.
At inference time, a new question retrieves the K nearest known questions
and returns their answers (semantic Q&A by retrieval).

Run:
    source ~/autogluon-env/bin/activate
    python scripts/build_retriever.py
"""

from __future__ import annotations

import json
import pickle
import time
from pathlib import Path

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

OUT = Path(".st-retriever")
OUT.mkdir(exist_ok=True)

print("Loading combined dataset...")
rows = [json.loads(l) for l in open("datasets/combined-qa.jsonl")]
problems = [r["problem"] for r in rows]
answers  = [r["answer"]  for r in rows]
subdomains = [r["subDomain"] for r in rows]
print(f"Total: {len(rows)} rows")

print("\nLoading sentence-transformer (all-MiniLM-L6-v2, 22M params)...")
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

print("Embedding all problems...")
t0 = time.time()
embs = model.encode(
    problems,
    batch_size=64,
    show_progress_bar=True,
    convert_to_numpy=True,
    normalize_embeddings=True,
)
print(f"Embedding took {time.time()-t0:.1f}s | shape={embs.shape}")

print("\nBuilding FAISS index (inner-product / cosine)...")
dim = embs.shape[1]
index = faiss.IndexFlatIP(dim)
index.add(embs.astype("float32"))
print(f"Index size: {index.ntotal}")

# Save everything
faiss.write_index(index, str(OUT / "faiss.index"))
with (OUT / "meta.pkl").open("wb") as f:
    pickle.dump({
        "problems":   problems,
        "answers":    answers,
        "subdomains": subdomains,
    }, f)
model.save(str(OUT / "model"))

print(f"\nSaved retriever → {OUT}")

# Quick sanity check
print("\n── Sample retrieval ──")
test_q = "If a train travels 240 km in 3 hours, what is its speed?"
q_emb  = model.encode([test_q], normalize_embeddings=True).astype("float32")
D, I   = index.search(q_emb, k=3)
print(f"Query: {test_q}")
for rank, (idx, score) in enumerate(zip(I[0], D[0]), 1):
    print(f"  #{rank} (sim={score:.3f}): {problems[idx][:80]}…")
    print(f"     → answer: {answers[idx]} | subDomain: {subdomains[idx]}")
