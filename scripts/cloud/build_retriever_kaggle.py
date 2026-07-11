"""
Build the PRODUCTION retrieval index on a FREE Kaggle GPU (keeps your Mac idle).

Mirrors scripts/build_production_retriever.py but runs on Kaggle's free T4/P100,
so embedding ~728K passages takes minutes instead of ~1.5 hrs on a laptop CPU —
and your machine stays cool and responsive.

────────────────────────────────────────────────────────────────────────────────
SETUP (free):
  1. Kaggle Dataset "learning-loop-corpus" with the four corpus files:
       datasets/math-corpus.jsonl, reasoning-corpus.jsonl,
       longform-corpus.jsonl, combined-qa.jsonl
     (longform is ~541 MB — Kaggle allows it. Upload once; reuse for training too.)
  2. New Notebook -> Add Data -> learning-loop-corpus.
     Settings -> Accelerator -> GPU T4 x2 (or P100). Internet: ON.
  3. First cell:  !pip -q install faiss-cpu sentence-transformers
  4. Paste/run this file.

GET THE INDEX BACK: output is /kaggle/working/st-retriever-prod (zip via the
Output tab), then locally:
    unzip st-retriever-prod.zip -d .st-retriever-prod   # the path ml_server loads
────────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import glob
import json
import time
from pathlib import Path

import faiss
import pandas as pd
import torch
from sentence_transformers import SentenceTransformer

OUT = Path("/kaggle/working/st-retriever-prod")
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


def find(name: str) -> str | None:
    hits = glob.glob(f"/kaggle/input/**/{name}", recursive=True)
    return hits[0] if hits else None


def load_qa(path: str, rows: list[dict]) -> int:
    n = 0
    with open(path) as f:
        for line in f:
            try:
                r = json.loads(line)
            except json.JSONDecodeError:
                continue
            text = r.get("problem") or r.get("question")
            if not text or len(text) < 10:
                continue
            rows.append({
                "text": text, "answer": str(r.get("answer") or ""),
                "solution": r.get("solution") or "",
                "subDomain": r.get("subDomain") or r.get("subdomain") or "general",
                "kind": "qa", "source": r.get("source") or path,
                "license": r.get("license") or "see-source", "url": r.get("url") or "",
            })
            n += 1
    print(f"[load] {path}: {n} QA rows")
    return n


def load_passages(path: str, rows: list[dict]) -> int:
    n = 0
    with open(path) as f:
        for line in f:
            try:
                r = json.loads(line)
            except json.JSONDecodeError:
                continue
            text = r.get("passage")
            if not text or len(text) < 10:
                continue
            rows.append({
                "text": text, "answer": "", "solution": "",
                "subDomain": r.get("subDomain") or "general", "kind": "passage",
                "source": r.get("source") or path,
                "license": r.get("license") or "see-source",
                "url": r.get("url") or "", "title": r.get("title") or "",
            })
            n += 1
    print(f"[load] {path}: {n} passage rows")
    return n


def main() -> None:
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {device}")
    assert device == "cuda", "Enable GPU: Notebook Settings -> Accelerator -> GPU."
    OUT.mkdir(parents=True, exist_ok=True)

    rows: list[dict] = []
    for name in ("math-corpus.jsonl", "reasoning-corpus.jsonl", "combined-qa.jsonl"):
        p = find(name)
        if p:
            load_qa(p, rows)
        else:
            print(f"[skip] {name} (not found in /kaggle/input)")
    lp = find("longform-corpus.jsonl")
    if lp:
        load_passages(lp, rows)
    else:
        print("[skip] longform-corpus.jsonl (not found)")

    assert rows, "No rows loaded — check the dataset is attached."
    print(f"\nTotal rows to index: {len(rows)}")

    model = SentenceTransformer(MODEL_NAME, device=device)
    print("Embedding on GPU...")
    t0 = time.time()
    embs = model.encode(
        [r["text"] for r in rows], batch_size=512, show_progress_bar=True,
        convert_to_numpy=True, normalize_embeddings=True,
    ).astype("float32")
    print(f"Embedding took {time.time()-t0:.1f}s | shape={embs.shape}")

    dim = embs.shape[1]
    index = faiss.IndexHNSWFlat(dim, 32, faiss.METRIC_INNER_PRODUCT)
    index.hnsw.efConstruction = 64
    index.add(embs)
    index.hnsw.efSearch = 64
    print(f"Index size: {index.ntotal}")

    faiss.write_index(index, str(OUT / "faiss.index"))
    meta = pd.DataFrame(rows)
    meta.to_parquet(OUT / "meta.parquet", index=False)
    model.save(str(OUT / "model"))
    stats = {
        "total": len(rows), "by_kind": meta["kind"].value_counts().to_dict(),
        "by_source": meta["source"].value_counts().head(20).to_dict(), "dim": dim,
    }
    (OUT / "stats.json").write_text(json.dumps(stats, indent=2))
    print(json.dumps(stats, indent=2))

    q = "A train covers 360 km in 4 hours. What is its speed?"
    qe = model.encode([q], normalize_embeddings=True).astype("float32")
    D, I = index.search(qe, 3)
    print(f"\nSample query: {q}")
    for rank, (i, sc) in enumerate(zip(I[0], D[0]), 1):
        r = rows[i]
        print(f"  #{rank} sim={sc:.3f} [{r['kind']}|{r['subDomain']}] {r['text'][:70]}…")
    print(f"\nSaved -> {OUT}")


if __name__ == "__main__":
    main()
