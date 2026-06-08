"""
Cloud GPU fine-tuning for the Learning Loop generation model (FLAN-T5), on Modal.

WHY: scripts/train_flan_t5.py is CPU-only, FLAN-T5-small, 2K rows / 1 epoch — a
toy. This trains a real model (default flan-t5-base) on the FULL ingested corpus
(math + reasoning + combined-qa, ~480K problem→solution pairs) on a cloud GPU in
~1–3 hours, learning chain-of-thought *solutions*, not just final answers.

Modal is serverless GPU: pay-per-second, no box to manage, wraps the existing
training almost verbatim. https://modal.com/docs

────────────────────────────────────────────────────────────────────────────────
ONE-TIME SETUP (on your machine):
    pip install modal
    modal token new            # opens browser, links your Modal account

RUN (uploads the corpus to a Modal Volume, then trains on GPU):
    modal run scripts/cloud/train_flan_t5_modal.py

    # bigger model / more data / longer:
    modal run scripts/cloud/train_flan_t5_modal.py --model google/flan-t5-large \
        --max-rows 480000 --epochs 3 --gpu A100

    # quick end-to-end smoke (cheap, ~few min):
    modal run scripts/cloud/train_flan_t5_modal.py --max-rows 4000 --epochs 1

PULL THE TRAINED MODEL BACK (into the path ml_server expects):
    modal volume get learning-loop-models /flan-t5-answer ./.flan-t5-answer

COST (rough): A10G ≈ $1.10/hr, A100 ≈ $3.70/hr. A base-model run on a few hundred
thousand rows is typically $3–10. Modal's free tier usually covers smoke tests.
────────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import os

import modal

APP_NAME = "learning-loop-flan-t5"
app = modal.App(APP_NAME)

# GPU image: torch + HF stack. (CUDA wheels come from the default torch package.)
image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "torch==2.5.1",
    "transformers==4.46.3",
    "datasets==3.1.0",
    "sentencepiece==0.2.0",
    "accelerate==1.1.1",
)

# Persistent volumes: one for the corpus, one for trained artifacts.
data_vol = modal.Volume.from_name("learning-loop-data", create_if_missing=True)
model_vol = modal.Volume.from_name("learning-loop-models", create_if_missing=True)

DATA_FILES = [
    "datasets/math-corpus.jsonl",
    "datasets/reasoning-corpus.jsonl",
    "datasets/combined-qa.jsonl",
]
OUT_NAME = "flan-t5-answer"  # -> ml_server expects .flan-t5-answer/


@app.function(
    image=image,
    gpu="A10G",  # overridden per-run by --gpu via .with_options in main()
    volumes={"/data": data_vol, "/models": model_vol},
    timeout=60 * 60 * 6,
)
def train(model_name: str, max_rows: int, epochs: int, lr: float, max_in: int, max_out: int):
    import json
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

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {device} | torch {torch.__version__}")
    if device == "cpu":
        print("WARNING: no CUDA visible — this will be very slow. Check --gpu.")

    # ── Build problem → (chain-of-thought) target pairs ──────────────────────
    def good_solution(s) -> bool:
        return bool(s) and str(s).strip().lower() not in ("none", "") and len(str(s)) > 15

    def to_pair(r: dict) -> dict | None:
        problem = r.get("problem") or r.get("question")
        answer = r.get("answer")
        if not problem or answer in (None, ""):
            return None
        sol = r.get("solution")
        # Prefer the worked solution (teaches reasoning); always pin the final answer.
        if good_solution(sol):
            target = f"{str(sol).strip()}\nFinal answer: {answer}"
        else:
            target = str(answer)
        return {"input_text": f"Solve: {problem}", "target_text": target}

    rows: list[dict] = []
    for path in DATA_FILES:
        p = Path("/data") / os.path.basename(path)
        if not p.exists():
            print(f"[skip] {p} (missing in volume)")
            continue
        with p.open() as f:
            for line in f:
                try:
                    pair = to_pair(json.loads(line))
                except json.JSONDecodeError:
                    continue
                if pair:
                    rows.append(pair)
    print(f"Built {len(rows)} pairs from {len(DATA_FILES)} corpora")

    random.seed(0)
    random.shuffle(rows)
    if max_rows and max_rows < len(rows):
        rows = rows[:max_rows]
    print(f"Training on {len(rows)} pairs (max_rows={max_rows})")

    print(f"Loading {model_name}...")
    tok = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_name)

    ds = Dataset.from_list(rows)
    split = ds.train_test_split(test_size=0.02, seed=0)
    train_ds, val_ds = split["train"], split["test"]
    print(f"Train: {len(train_ds)} | Val: {len(val_ds)}")

    def preprocess(ex):
        model_in = tok(ex["input_text"], max_length=max_in, truncation=True)
        labels = tok(text_target=ex["target_text"], max_length=max_out, truncation=True)
        model_in["labels"] = labels["input_ids"]
        return model_in

    train_tok = train_ds.map(preprocess, remove_columns=train_ds.column_names)
    val_tok = val_ds.map(preprocess, remove_columns=val_ds.column_names)
    collator = DataCollatorForSeq2Seq(tok, model=model)

    out = f"/models/{OUT_NAME}"
    args = Seq2SeqTrainingArguments(
        output_dir=out,
        overwrite_output_dir=True,
        num_train_epochs=epochs,
        per_device_train_batch_size=16,
        per_device_eval_batch_size=16,
        gradient_accumulation_steps=2,
        learning_rate=lr,
        warmup_ratio=0.03,
        logging_steps=100,
        eval_strategy="epoch",
        save_strategy="epoch",
        save_total_limit=1,
        predict_with_generate=True,
        generation_max_length=max_out,
        bf16=(device == "cuda"),
        report_to="none",
    )
    trainer = Seq2SeqTrainer(
        model=model, args=args, train_dataset=train_tok, eval_dataset=val_tok,
        tokenizer=tok, data_collator=collator,
    )

    print("\nTraining...")
    t0 = time.time()
    trainer.train()
    dt = time.time() - t0
    print(f"Done in {dt/60:.1f} min")

    trainer.save_model(out)
    tok.save_pretrained(out)

    # Persist a metrics sidecar that CAN be committed to git (small JSON).
    metrics = {
        "model_name": model_name, "rows": len(rows), "epochs": epochs,
        "train_seconds": round(dt, 1), "eval": trainer.evaluate(),
        "device": device,
    }
    with open(f"{out}/train_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2, default=float)
    model_vol.commit()
    print(f"Saved → volume learning-loop-models:/{OUT_NAME}")

    # Smoke predictions
    model.eval()
    for q in [
        "A train covers 360 km in 4 hours. What is its speed in km/h?",
        "If 8 workers build a wall in 10 days, how many days will 16 workers take?",
    ]:
        inp = tok(f"Solve: {q}", return_tensors="pt").to(model.device)
        gen = model.generate(**inp, max_new_tokens=max_out)
        print(f"\nQ: {q}\nA: {tok.decode(gen[0], skip_special_tokens=True)}")
    return metrics


@app.local_entrypoint()
def main(
    model: str = "google/flan-t5-base",
    max_rows: int = 200_000,
    epochs: int = 2,
    lr: float = 3e-4,
    max_in: int = 320,
    max_out: int = 200,
    gpu: str = "A10G",
    skip_upload: bool = False,
):
    if not skip_upload:
        print("Uploading corpora to Modal volume 'learning-loop-data' ...")
        with data_vol.batch_upload(force=True) as batch:
            for f in DATA_FILES:
                if os.path.exists(f):
                    batch.put_file(f, "/" + os.path.basename(f))
                    print(f"  + {f}")
                else:
                    print(f"  ! missing locally: {f}")
        print("Upload complete.")

    metrics = train.with_options(gpu=gpu).remote(
        model_name=model, max_rows=max_rows, epochs=epochs, lr=lr,
        max_in=max_in, max_out=max_out,
    )
    print("\n=== TRAINING METRICS ===")
    print(metrics)
    print(
        "\nPull the model back with:\n"
        f"    modal volume get learning-loop-models /{OUT_NAME} ./.{OUT_NAME}"
    )
