"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const presets = [
  { size: 10, durationSeconds: 1200, label: "Quick · 10Q · 20m" },
  { size: 15, durationSeconds: 1800, label: "Standard · 15Q · 30m" },
  { size: 20, durationSeconds: 2400, label: "Endurance · 20Q · 40m" },
];

const topics = ["Mixed", "Quantitative", "VARC", "DILR"] as const;

export function MockLauncher() {
  const router = useRouter();
  const [topic, setTopic] = useState<(typeof topics)[number]>("Mixed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async (preset: (typeof presets)[number]) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/mock-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: preset.size, durationSeconds: preset.durationSeconds, topic }),
      });
      const data = await res.json();
      if (!res.ok || !data.id) throw new Error(data.error || "Failed to start test");
      router.push(`/practice/mock/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the test.");
      setBusy(false);
    }
  };

  return (
    <div className="paper-card p-5 space-y-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-2">
          Choose a focus
        </p>
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className={`rounded px-3 py-1.5 text-sm font-mono border transition-colors ${
                topic === t
                  ? "border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)]"
                  : "border-[var(--border)] hover:border-[var(--gold)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {presets.map((p) => (
          <button
            key={p.label}
            disabled={busy}
            onClick={() => start(p)}
            className="paper-card p-4 text-left hover:border-[var(--gold)] disabled:opacity-50"
          >
            <p className="font-serif text-xl">{p.label.split(" · ")[0]}</p>
            <p className="font-mono text-xs text-[var(--muted)] mt-1">{p.label}</p>
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-[var(--red)] font-mono">{error}</p>}
    </div>
  );
}
