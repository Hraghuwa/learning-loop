"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  initialName: string;
  initialTarget: number;
  initialExam: string;
};

export function SettingsForm({ initialName, initialTarget, initialExam }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [target, setTarget] = useState(initialTarget);
  const [exam, setExam] = useState(initialExam);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          target_percentile: target,
          target_exam: exam,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
          Display name
        </label>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--paper2)] p-3 outline-none focus:border-[var(--gold)]"
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
              onClick={() => {
                setExam(e);
                setSaved(false);
              }}
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
        <div className="mt-1 flex items-center gap-3">
          <input
            type="range"
            min={50}
            max={99}
            value={target}
            onChange={(e) => {
              setTarget(Number(e.target.value));
              setSaved(false);
            }}
            className="flex-1"
          />
          <span className="font-serif text-2xl">{target}</span>
        </div>
      </div>
      {error && <p className="text-sm text-[var(--red)] font-mono">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary btn-sm"
        >
          {busy ? "Saving..." : "Save"}
        </button>
        {saved && <p className="text-xs font-mono text-[var(--green)]">Saved.</p>}
      </div>
    </form>
  );
}
