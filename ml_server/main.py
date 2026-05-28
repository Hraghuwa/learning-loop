"""
FastAPI backend wrapping all 4 trained ML models.

Run:
    source ~/autogluon-env/bin/activate
    uvicorn ml_server.main:app --reload --port 8000

Endpoints:
  GET  /health                — liveness + which models loaded
  POST /classify              — Tabular + MultiModal subDomain prediction
  POST /retrieve              — Top-K similar Q&A via sentence-transformer
  POST /generate              — FLAN-T5 answer generation
  POST /predict-all           — Runs all of the above in one shot
"""

from __future__ import annotations

import os

# ── OpenMP / threading guards (must come BEFORE torch/lightgbm imports) ────
os.environ.setdefault("KMP_DUPLICATE_LIB_OK",  "TRUE")
os.environ.setdefault("OMP_NUM_THREADS",       "1")
os.environ.setdefault("MKL_NUM_THREADS",       "1")
os.environ.setdefault("MKL_THREADING_LAYER",   "GNU")
os.environ.setdefault("TOKENIZERS_PARALLELISM","false")

# Import torch FIRST so its libomp is the one in memory before LightGBM links its own
import torch  # noqa: F401  (deliberate early import)
torch.set_num_threads(1)

import pickle
import sys
import time
import types
from pathlib import Path
from typing import Optional

# ── Stub nvidia_smi before importing autogluon (macOS workaround) ──────────
fake = types.ModuleType("nvidia_smi")
fake.nvmlInit                   = lambda: None
fake.nvmlShutdown               = lambda: None
fake.nvmlDeviceGetCount         = lambda: 0
fake.nvmlDeviceGetHandleByIndex = lambda i: None
class _MemInfo:
    total = free = used = 0
fake.nvmlDeviceGetMemoryInfo    = lambda h: _MemInfo()
sys.modules["nvidia_smi"]       = fake

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Project root: ml_server/main.py → parent.parent
ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)

# ── Lazy global model handles ──────────────────────────────────────────────
_models: dict = {}

def _load_tabular():
    if "tabular" in _models:
        return _models["tabular"]
    from autogluon.tabular import TabularPredictor
    print("Loading AutoGluon Tabular...")
    _models["tabular"] = TabularPredictor.load(".autogluon-big-subdomain", verbosity=0)
    return _models["tabular"]

def _load_multimodal():
    if "multimodal" in _models:
        return _models["multimodal"]
    p = Path(".autogluon-mm-subdomain")
    if not (p / "model.ckpt").exists() and not any(p.glob("**/*.ckpt")):
        return None
    from autogluon.multimodal import MultiModalPredictor
    print("Loading AutoGluon MultiModal...")
    try:
        _models["multimodal"] = MultiModalPredictor.load(str(p))
        return _models["multimodal"]
    except Exception as e:
        print(f"MultiModal load failed: {e}")
        return None

def _load_retriever():
    if "retriever" in _models:
        return _models["retriever"]
    import faiss
    from sentence_transformers import SentenceTransformer
    print("Loading sentence-transformer retriever...")
    model = SentenceTransformer(".st-retriever/model")
    index = faiss.read_index(".st-retriever/faiss.index")
    meta  = pickle.load(open(".st-retriever/meta.pkl", "rb"))
    _models["retriever"] = (model, index, meta)
    return _models["retriever"]

def _load_flan_t5():
    if "flan_t5" in _models:
        return _models["flan_t5"]
    import torch
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
    print("Loading FLAN-T5 fine-tuned...")
    tok   = AutoTokenizer.from_pretrained(".flan-t5-answer")
    model = AutoModelForSeq2SeqLM.from_pretrained(".flan-t5-answer").to("cpu")
    model.eval()
    _models["flan_t5"] = (tok, model)
    return _models["flan_t5"]

# ── FastAPI ────────────────────────────────────────────────────────────────
app = FastAPI(title="Learning Loop ML API", version="0.1.0")

# Allow Next.js dev server (3000) → Python backend (8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Schemas ────────────────────────────────────────────────────────────────
class Question(BaseModel):
    problem: str = Field(..., min_length=3, max_length=2000)
    top_k:   int = Field(3, ge=1, le=10, description="K for retriever")

class ClassifyOut(BaseModel):
    tabular_subDomain:    Optional[str] = None
    multimodal_subDomain: Optional[str] = None
    latency_ms:           dict

class RetrievedItem(BaseModel):
    problem:   str
    answer:    str
    subDomain: str
    score:     float

class RetrieveOut(BaseModel):
    items:      list[RetrievedItem]
    latency_ms: float

class GenerateOut(BaseModel):
    answer:     str
    latency_ms: float

class PredictAllOut(BaseModel):
    classify: ClassifyOut
    retrieve: RetrieveOut
    generate: GenerateOut

# ── Routes ─────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "ok": True,
        "loaded": list(_models.keys()),
        "available": {
            "tabular":    Path(".autogluon-big-subdomain").exists(),
            "multimodal": Path(".autogluon-mm-subdomain").exists(),
            "retriever":  Path(".st-retriever/faiss.index").exists(),
            "flan_t5":    Path(".flan-t5-answer").exists(),
        },
    }

@app.post("/classify", response_model=ClassifyOut)
def classify(q: Question):
    import pandas as pd
    X = pd.DataFrame({"problem": [q.problem]})
    latency = {}
    out = {}

    try:
        t0 = time.time()
        out["tabular_subDomain"] = str(_load_tabular().predict(X).iloc[0])
        latency["tabular"] = round((time.time() - t0) * 1000, 1)
    except Exception as e:
        out["tabular_subDomain"] = None
        latency["tabular_error"] = str(e)[:120]

    mm = _load_multimodal()
    if mm is not None:
        try:
            t0 = time.time()
            out["multimodal_subDomain"] = str(mm.predict(X).iloc[0])
            latency["multimodal"] = round((time.time() - t0) * 1000, 1)
        except Exception as e:
            out["multimodal_subDomain"] = None
            latency["multimodal_error"] = str(e)[:120]

    return ClassifyOut(latency_ms=latency, **out)

@app.post("/retrieve", response_model=RetrieveOut)
def retrieve(q: Question):
    try:
        model, index, meta = _load_retriever()
    except Exception as e:
        raise HTTPException(503, f"Retriever not loaded: {e}")

    t0 = time.time()
    emb = model.encode([q.problem], normalize_embeddings=True).astype("float32")
    D, I = index.search(emb, k=q.top_k)
    items = [
        RetrievedItem(
            problem=meta["problems"][i],
            answer=meta["answers"][i],
            subDomain=meta["subdomains"][i],
            score=float(score),
        )
        for i, score in zip(I[0], D[0])
    ]
    return RetrieveOut(items=items, latency_ms=round((time.time() - t0) * 1000, 1))

@app.post("/generate", response_model=GenerateOut)
def generate(q: Question):
    import torch
    try:
        tok, model = _load_flan_t5()
    except Exception as e:
        raise HTTPException(503, f"FLAN-T5 not loaded: {e}")

    t0 = time.time()
    inp = tok(f"Solve: {q.problem}", return_tensors="pt", truncation=True, max_length=256)
    with torch.no_grad():
        out = model.generate(**inp, max_new_tokens=32)
    answer = tok.decode(out[0], skip_special_tokens=True).strip()
    return GenerateOut(answer=answer, latency_ms=round((time.time() - t0) * 1000, 1))

@app.post("/predict-all", response_model=PredictAllOut)
def predict_all(q: Question):
    return PredictAllOut(
        classify=classify(q),
        retrieve=retrieve(q),
        generate=generate(q),
    )
