"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  initialName: string;
  initialTarget: number;
  initialExam: string;
};

export function OnboardingForm({ initialName, initialTarget, initialExam }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [target, setTarget] = useState(initialTarget);
  const [exam, setExam] = useState(initialExam);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bootstrap: true,
          name: name.trim() || "Student",
          target_percentile: target,
          target_exam: exam,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Could not save profile");
      }
      router.push("/practice");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5 paper-card p-6">
      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
          Your name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What should we call you?"
          className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--paper2)] p-3 text-lg font-serif outline-none focus:border-[var(--gold)]"
        />
      </div>

      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
          Target exam
        </label>
        <div className="mt-1 flex gap-2 flex-wrap">
          {["CAT", "XAT", "CMAT", "Other"].map((e) => (
            <button
              type="button"
              key={e}
              onClick={() => setExam(e)}
              className={`rounded px-3 py-1.5 font-mono text-xs border ${
                exam === e
                  ? "border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)]"
                  : "border-[var(--border)] hover:border-[var(--gold)]"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
          Target percentile
        </label>
        <div className="mt-2 flex items-center gap-3">
          <input
            type="range"
            min={50}
            max={99}
            step={1}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="flex-1"
          />
          <span className="font-serif text-3xl">{target}</span>
        </div>
        <p className="text-xs text-[var(--muted)] mt-1">
          {target >= 95
            ? "Aggressive — top schools target."
            : target >= 85
              ? "Strong — most reputable B-schools."
              : "Realistic baseline — we'll calibrate the plan accordingly."}
        </p>
      </div>

      {error && <p className="text-sm text-[var(--red)] font-mono">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded bg-[var(--gold)] text-white py-3 font-mono text-sm hover:bg-[var(--gold-dark)] disabled:opacity-50"
      >
        {busy ? "Saving..." : "Start practising →"}
      </button>
    </form>
  );
}
