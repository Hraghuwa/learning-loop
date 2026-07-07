"""
Recall@k evaluation for the production retriever (.st-retriever-prod).

Works on ANY size of the prod artifact — the 2k smoke build or the full 728k
Kaggle build — so the same numbers are comparable across builds. Light enough
for the Mac (a few hundred CPU embeddings).

Probes (per sampled QA row):
  self       — query with the stored text verbatim. Recall@1 should be ~1.0;
               anything less means index/metadata rows are misaligned.
  truncated  — query with the first 60% of the text (dropped tail). Measures
               robustness to partial/lossy queries, which is what real user
               questions look like relative to corpus phrasing.

Run:
    source ~/autogluon-env/bin/activate
    python scripts/eval_retriever.py            # default 200 samples
    python scripts/eval_retriever.py --n 500 --k 1 3 5

Output: metrics printed + written to .st-retriever-prod/eval.json
(committed metrics live in docs/loop/ notes, not the gitignored artifact dir).
"""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

PROD = Path(".st-retriever-prod")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=200, help="rows to sample")
    ap.add_argument("--k", type=int, nargs="+", default=[1, 3, 5])
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    import faiss
    import pandas as pd
    from sentence_transformers import SentenceTransformer

    assert (PROD / "faiss.index").exists(), "no prod retriever — run the Kaggle build first"
    index = faiss.read_index(str(PROD / "faiss.index"))
    meta = pd.read_parquet(PROD / "meta.parquet")
    model = SentenceTransformer(str(PROD / "model"))
    assert index.ntotal == len(meta), (
        f"index/meta misaligned: {index.ntotal} vectors vs {len(meta)} rows"
    )
    print(f"Index: {index.ntotal} vectors | dim {index.d}")

    rng = random.Random(args.seed)
    qa_idx = [i for i, kind in enumerate(meta["kind"]) if kind == "qa"]
    sample = rng.sample(qa_idx, min(args.n, len(qa_idx)))
    texts = [str(meta.iloc[i]["text"]) for i in sample]

    kmax = max(args.k)

    def recall(queries: list[str]) -> dict[int, float]:
        embs = model.encode(
            queries, batch_size=64, convert_to_numpy=True, normalize_embeddings=True
        ).astype("float32")
        _, I = index.search(embs, kmax)
        hits = {k: 0 for k in args.k}
        for row, target in zip(I, sample):
            for k in args.k:
                if target in row[:k]:
                    hits[k] += 1
        return {k: round(v / len(queries), 4) for k, v in hits.items()}

    print(f"\nProbing {len(sample)} QA rows…")
    self_recall = recall(texts)
    trunc_recall = recall([t[: max(20, int(len(t) * 0.6))] for t in texts])

    out = {
        "index_size": index.ntotal,
        "samples": len(sample),
        "k": args.k,
        "self_recall": self_recall,        # sanity: ~1.0 or rows are misaligned
        "truncated60_recall": trunc_recall,  # robustness to partial queries
    }
    print(json.dumps(out, indent=2))
    (PROD / "eval.json").write_text(json.dumps(out, indent=2))
    print(f"\nSaved -> {PROD / 'eval.json'}")

    if self_recall.get(1, 0) < 0.98:
        raise SystemExit(
            "FAIL: self recall@1 < 0.98 — index and metadata rows are misaligned"
        )
    print("OK: self recall@1 sanity passed")


if __name__ == "__main__":
    main()
