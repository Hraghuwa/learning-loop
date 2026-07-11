"""
Fine-tune FLAN-T5 for answer/solution generation — FREE, on your Mac's GPU (MPS).

This is the default, zero-cost training path: no cloud account, no credits. It uses
Apple Metal (MPS) when available and trains on a curated subset of the FULL ingested
corpus (math + reasoning + combined-qa), learning chain-of-thought *solutions*
(problem -> solution + "Final answer: ..."), not just bare answers.

Run (free, local):
    source ~/autogluon-env/bin/activate
    python scripts/train_flan_t5.py                         # flan-t5-small, 30K rows, 2 epochs
    python scripts/train_flan_t5.py --rows 60000 --epochs 3 # push it further
    python scripts/train_flan_t5.py --model google/flan-t5-base --rows 20000
    python scripts/train_flan_t5.py --rows 300 --epochs 1   # quick smoke

Scale up for FREE on a bigger GPU: scripts/cloud/train_flan_t5_kaggle.py
  (Kaggle Notebooks — free T4/P100, 30 hrs/week). Modal (paid) is optional only.

Output -> .flan-t5-answer/  (the path ml_server loads). Binaries are git-ignored;
a small train_metrics.json sidecar is written for committing.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import time
from pathlib import Path

import torch
from datasets import Dataset
from transformers import (
    AutoModelForSeq2SeqLM,
    AutoTokenizer,
    DataCollatorForSeq2Seq,
    Seq2SeqTrainer,
    Seq2SeqTrainingArguments,
)

OUT = Path(".flan-t5-answer")
DATA_FILES = [
    "datasets/math-corpus.jsonl",
    "datasets/reasoning-corpus.jsonl",
    "datasets/combined-qa.jsonl",
]


def pick_device() -> str:
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def good_solution(s) -> bool:
    return bool(s) and str(s).strip().lower() not in ("none", "") and len(str(s)) > 15


def to_pair(r: dict) -> dict | None:
    problem = r.get("problem") or r.get("question")
    answer = r.get("answer")
    if not problem or answer in (None, ""):
        return None
    sol = r.get("solution")
    target = f"{str(sol).strip()}\nFinal answer: {answer}" if good_solution(sol) else str(answer)
    return {"input_text": f"Solve: {problem}", "target_text": target}


def load_pairs(prefer_solutions: bool) -> list[dict]:
    pairs: list[dict] = []
    for path in DATA_FILES:
        p = Path(path)
        if not p.exists():
            print(f"[skip] {path} (missing)")
            continue
        with p.open() as f:
            for line in f:
                try:
                    pair = to_pair(json.loads(line))
                except json.JSONDecodeError:
                    continue
                if pair:
                    pairs.append(pair)
    # Curate: put worked-solution examples first (richer training signal).
    if prefer_solutions:
        pairs.sort(key=lambda x: 0 if "\nFinal answer:" in x["target_text"] else 1)
    return pairs


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="google/flan-t5-small")
    ap.add_argument("--rows", type=int, default=30_000)
    ap.add_argument("--epochs", type=float, default=2.0)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("--max-in", type=int, default=320)
    ap.add_argument("--max-out", type=int, default=200)
    ap.add_argument("--no-curate", action="store_true", help="don't prioritise solution rows")
    args = ap.parse_args()

    device = pick_device()
    print(f"Device: {device} | torch {torch.__version__}")
    if device == "cpu":
        print("NOTE: no GPU/MPS detected — training will be slow. Reduce --rows.")

    print(f"Loading {args.model}...")
    tok = AutoTokenizer.from_pretrained(args.model)
    model = AutoModelForSeq2SeqLM.from_pretrained(args.model)

    print("Loading corpora...")
    pairs = load_pairs(prefer_solutions=not args.no_curate)
    print(f"Available pairs: {len(pairs)}")
    if not args.no_curate:
        pairs = pairs[: args.rows]            # take the curated (solution-first) head
    random.seed(0)
    random.shuffle(pairs)
    if args.no_curate and args.rows < len(pairs):
        pairs = pairs[: args.rows]
    print(f"Training on {len(pairs)} pairs")

    ds = Dataset.from_list(pairs)
    split = ds.train_test_split(test_size=0.05, seed=0)
    train_ds, val_ds = split["train"], split["test"]
    print(f"Train: {len(train_ds)} | Val: {len(val_ds)}")

    def preprocess(ex):
        model_in = tok(ex["input_text"], max_length=args.max_in, truncation=True)
        labels = tok(text_target=ex["target_text"], max_length=args.max_out, truncation=True)
        model_in["labels"] = labels["input_ids"]
        return model_in

    train_tok = train_ds.map(preprocess, remove_columns=train_ds.column_names)
    val_tok = val_ds.map(preprocess, remove_columns=val_ds.column_names)
    collator = DataCollatorForSeq2Seq(tok, model=model)

    targs = Seq2SeqTrainingArguments(
        output_dir=str(OUT),
        overwrite_output_dir=True,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch,
        per_device_eval_batch_size=args.batch,
        gradient_accumulation_steps=2,
        learning_rate=args.lr,
        warmup_ratio=0.03,
        logging_steps=50,
        eval_strategy="epoch",
        save_strategy="epoch",
        save_total_limit=1,
        predict_with_generate=True,
        generation_max_length=args.max_out,
        fp16=False,  # MPS does not support fp16 training reliably
        bf16=False,
        report_to="none",
        dataloader_pin_memory=(device == "cuda"),
    )
    trainer = Seq2SeqTrainer(
        model=model, args=targs, train_dataset=train_tok, eval_dataset=val_tok,
        tokenizer=tok, data_collator=collator,
    )

    print("\nTraining (free, local)...")
    t0 = time.time()
    trainer.train()
    dt = time.time() - t0
    print(f"Done in {dt/60:.1f} min")

    trainer.save_model(str(OUT))
    tok.save_pretrained(str(OUT))
    metrics = {
        "model": args.model, "rows": len(pairs), "epochs": args.epochs,
        "device": device, "train_seconds": round(dt, 1), "eval": trainer.evaluate(),
    }
    OUT.mkdir(exist_ok=True)
    with open(OUT / "train_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2, default=float)
    print(f"Saved -> {OUT}  (metrics: {OUT/'train_metrics.json'})")

    print("\n-- sample predictions --")
    model.eval()
    for q in [
        "A train covers 360 km in 4 hours. What is its speed in km/h?",
        "If 8 workers build a wall in 10 days, how many days will 16 workers take?",
    ]:
        inp = tok(f"Solve: {q}", return_tensors="pt").to(model.device)
        gen = model.generate(**inp, max_new_tokens=args.max_out)
        print(f"Q: {q}\nA: {tok.decode(gen[0], skip_special_tokens=True)}\n")


if __name__ == "__main__":
    main()
