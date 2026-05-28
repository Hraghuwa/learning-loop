"""
Fine-tune FLAN-T5-small (~80M params) on combined-qa.jsonl for answer
generation: problem → answer.

Run:
    source ~/autogluon-env/bin/activate
    python scripts/train_flan_t5.py
"""

from __future__ import annotations

import json
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

MODEL_NAME = "google/flan-t5-small"
OUT        = Path(".flan-t5-answer")

print(f"Loading {MODEL_NAME}...")
tok   = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)

# CPU-only on Mac
device = "cpu"
model.to(device)
print(f"Device: {device}")

# ── Load data ──────────────────────────────────────────────────────────────
print("\nLoading combined dataset...")
rows = [json.loads(l) for l in open("datasets/combined-qa.jsonl")]

# To keep training tractable on CPU, sample 2K rows
import random
random.seed(0)
random.shuffle(rows)
rows = rows[:2000]

def to_pair(r):
    return {
        "input_text":  f"Solve: {r['problem']}",
        "target_text": str(r["answer"]),
    }

ds = Dataset.from_list([to_pair(r) for r in rows])
split = ds.train_test_split(test_size=0.1, seed=0)
train_ds, val_ds = split["train"], split["test"]
print(f"Train: {len(train_ds)} | Val: {len(val_ds)}")

# ── Tokenize ───────────────────────────────────────────────────────────────
MAX_IN, MAX_OUT = 256, 32

def preprocess(ex):
    model_in = tok(ex["input_text"],  max_length=MAX_IN,  truncation=True)
    labels   = tok(ex["target_text"], max_length=MAX_OUT, truncation=True)
    model_in["labels"] = labels["input_ids"]
    return model_in

train_tok = train_ds.map(preprocess, batched=False, remove_columns=train_ds.column_names)
val_tok   = val_ds.map(preprocess,   batched=False, remove_columns=val_ds.column_names)

collator = DataCollatorForSeq2Seq(tok, model=model)

# ── Training args (CPU-friendly) ──────────────────────────────────────────
args = Seq2SeqTrainingArguments(
    output_dir=str(OUT),
    overwrite_output_dir=True,
    num_train_epochs=1,
    per_device_train_batch_size=8,
    per_device_eval_batch_size=8,
    learning_rate=3e-4,
    warmup_steps=50,
    logging_steps=50,
    save_steps=999_999,            # only final
    eval_strategy="epoch",
    save_strategy="epoch",
    predict_with_generate=True,
    generation_max_length=MAX_OUT,
    fp16=False, bf16=False,
    report_to="none",
)

trainer = Seq2SeqTrainer(
    model=model,
    args=args,
    train_dataset=train_tok,
    eval_dataset=val_tok,
    tokenizer=tok,
    data_collator=collator,
)

print("\nStarting fine-tune (CPU is slow — be patient)...")
t0 = time.time()
trainer.train()
print(f"\nFine-tune took {time.time()-t0:.1f}s")

trainer.save_model(str(OUT))
tok.save_pretrained(str(OUT))
print(f"Saved → {OUT}")

# ── Quick test ─────────────────────────────────────────────────────────────
print("\n── Sample predictions ──")
test_qs = [
    "A train covers 360 km in 4 hours. What is its speed in km/h?",
    "If 8 workers build a wall in 10 days, how many days will 16 workers take?",
    "Find the simple interest on Rs 1000 at 10% per annum for 3 years.",
]
model.eval()
for q in test_qs:
    inp = tok(f"Solve: {q}", return_tensors="pt").to(device)
    out = model.generate(**inp, max_new_tokens=16)
    print(f"Q: {q}\nA: {tok.decode(out[0], skip_special_tokens=True)}\n")
