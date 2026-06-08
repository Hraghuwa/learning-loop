"""
FREE GPU fine-tuning on Kaggle Notebooks (T4/P100, 30 hrs/week, no cost).

This is the free scale-up path when the local MPS trainer (scripts/train_flan_t5.py)
isn't enough — bigger model (flan-t5-base/large) or the full corpus. Kaggle gives a
real GPU for free and is far more stable than Colab for multi-hour runs.

────────────────────────────────────────────────────────────────────────────────
SETUP (one-time, free):
  1. Create a free account at https://kaggle.com and verify your phone (unlocks GPU).
  2. Make a Kaggle Dataset from the corpus:
       - Datasets -> New Dataset -> upload these files:
           datasets/math-corpus.jsonl
           datasets/reasoning-corpus.jsonl
           datasets/combined-qa.jsonl
       - name it e.g. "learning-loop-corpus"
  3. New Notebook -> Add Data -> your dataset.
     Settings -> Accelerator -> GPU T4 x2 (or P100). Internet: ON.
  4. Paste this file into a cell (or: File -> Upload) and run it.

RUN (in the notebook): just run the cell. Tweak the CONFIG block below.

GET THE MODEL BACK: when done it's at /kaggle/working/flan-t5-answer — use the
notebook's "Output" tab to download, then locally:
    unzip flan-t5-answer.zip -d .flan-t5-answer   # -> the path ml_server loads
────────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import glob
import json
import os
import random
import time

import torch
from datasets import Dataset
from transformers import (
    AutoModelForSeq2SeqLM,
    AutoTokenizer,
    DataCollatorForSeq2Seq,
    Seq2SeqTrainer,
    Seq2SeqTrainingArguments,
)

# ── CONFIG ──────────────────────────────────────────────────────────────────
MODEL = "google/flan-t5-base"   # free GPU handles base comfortably; try -large too
MAX_ROWS = 200_000
EPOCHS = 3
LR = 3e-4
BATCH = 16
MAX_IN, MAX_OUT = 320, 200
OUT = "/kaggle/working/flan-t5-answer"
# Kaggle mounts datasets under /kaggle/input/<slug>/. We glob so the slug can vary.
INPUT_GLOB = "/kaggle/input/**/*-corpus.jsonl"
COMBINED_GLOB = "/kaggle/input/**/combined-qa.jsonl"
# ────────────────────────────────────────────────────────────────────────────


def good_solution(s) -> bool:
    return bool(s) and str(s).strip().lower() not in ("none", "") and len(str(s)) > 15


def to_pair(r: dict):
    problem = r.get("problem") or r.get("question")
    answer = r.get("answer")
    if not problem or answer in (None, ""):
        return None
    sol = r.get("solution")
    target = f"{str(sol).strip()}\nFinal answer: {answer}" if good_solution(sol) else str(answer)
    return {"input_text": f"Solve: {problem}", "target_text": target}


def main():
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {device} | torch {torch.__version__}")
    assert device == "cuda", "Enable GPU: Notebook Settings -> Accelerator -> GPU."

    files = sorted(set(glob.glob(INPUT_GLOB, recursive=True) +
                       glob.glob(COMBINED_GLOB, recursive=True)))
    print("Corpus files:", files)
    pairs = []
    for path in files:
        with open(path) as f:
            for line in f:
                try:
                    p = to_pair(json.loads(line))
                except json.JSONDecodeError:
                    continue
                if p:
                    pairs.append(p)
    pairs.sort(key=lambda x: 0 if "\nFinal answer:" in x["target_text"] else 1)
    pairs = pairs[:MAX_ROWS]
    random.seed(0)
    random.shuffle(pairs)
    print(f"Training on {len(pairs)} pairs")

    tok = AutoTokenizer.from_pretrained(MODEL)
    model = AutoModelForSeq2SeqLM.from_pretrained(MODEL)

    ds = Dataset.from_list(pairs).train_test_split(test_size=0.02, seed=0)

    def preprocess(ex):
        mi = tok(ex["input_text"], max_length=MAX_IN, truncation=True)
        mi["labels"] = tok(text_target=ex["target_text"], max_length=MAX_OUT, truncation=True)["input_ids"]
        return mi

    train_tok = ds["train"].map(preprocess, remove_columns=ds["train"].column_names)
    val_tok = ds["test"].map(preprocess, remove_columns=ds["test"].column_names)

    args = Seq2SeqTrainingArguments(
        output_dir=OUT, overwrite_output_dir=True,
        num_train_epochs=EPOCHS, per_device_train_batch_size=BATCH,
        per_device_eval_batch_size=BATCH, gradient_accumulation_steps=2,
        learning_rate=LR, warmup_ratio=0.03, logging_steps=100,
        eval_strategy="epoch", save_strategy="epoch", save_total_limit=1,
        predict_with_generate=True, generation_max_length=MAX_OUT,
        bf16=True, report_to="none",
    )
    trainer = Seq2SeqTrainer(
        model=model, args=args, train_dataset=train_tok, eval_dataset=val_tok,
        tokenizer=tok, data_collator=DataCollatorForSeq2Seq(tok, model=model),
    )
    t0 = time.time()
    trainer.train()
    print(f"Done in {(time.time()-t0)/60:.1f} min")
    trainer.save_model(OUT)
    tok.save_pretrained(OUT)
    with open(os.path.join(OUT, "train_metrics.json"), "w") as f:
        json.dump({"model": MODEL, "rows": len(pairs), "epochs": EPOCHS,
                   "eval": trainer.evaluate()}, f, indent=2, default=float)
    print(f"Saved -> {OUT}")


if __name__ == "__main__":
    main()
