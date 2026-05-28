"use client";

import { useState } from "react";

type StudyPlan = {
  goal: string;
  weeklyHours: number;
  weeks: {
    weekNumber: number;
    focus: string;
    rationale: string;
    dailyDrills: { day: string; task: string; minutes: number }[];
    successSignal: string;
  }[];
  guardrails: string[];
};

type SavedPlan = {
  id: string;
  payload: StudyPlan;
  target_percentile: number;
  weekly_hours: number;
  generated_at: string;
};

type Props = {
  saved: SavedPlan | null;
  defaultTargetPercentile: number;
};

export function StudyPlanPanel({ saved, defaultTargetPercentile }: Props) {
  const [plan, setPlan] = useState<StudyPlan | null>(saved?.payload ?? null);
  const [targetPercentile, setTargetPercentile] = useState<number>(saved?.target_percentile ?? defaultTargetPercentile);
  const [weeklyHours, setWeeklyHours] = useState<number>(saved?.weekly_hours ?? 7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(saved?.generated_at ?? null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/insights/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPercentile, weeklyHours }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Plan generation failed");
      setPlan(data.plan);
      setGeneratedAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate plan.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="paper-card p-6 space-y-5 border-l-4 border-l-[var(--gold)]">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Personalised plan
          </p>
          <h2 className="font-serif text-2xl mt-1">4-week study plan</h2>
          {generatedAt && (
            <p className="font-mono text-[10px] text-[var(--muted)] mt-1">
              Generated {new Date(generatedAt).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap items-end">
          <label className="text-xs font-mono">
            <span className="block text-[var(--muted)] text-[10px] uppercase tracking-widest">
              Target %ile
            </span>
            <input
              type="number"
              min={50}
              max={99}
              value={targetPercentile}
              onChange={(e) => setTargetPercentile(Number(e.target.value))}
              className="rounded border border-[var(--border)] bg-[var(--paper2)] px-2 py-1 text-sm w-20"
            />
          </label>
          <label className="text-xs font-mono">
            <span className="block text-[var(--muted)] text-[10px] uppercase tracking-widest">
              Hours/wk
            </span>
            <input
              type="number"
              min={2}
              max={40}
              value={weeklyHours}
              onChange={(e) => setWeeklyHours(Number(e.target.value))}
              className="rounded border border-[var(--border)] bg-[var(--paper2)] px-2 py-1 text-sm w-20"
            />
          </label>
          <button
            disabled={busy}
            onClick={generate}
            className="rounded bg-[var(--gold)] text-white px-3 py-1.5 text-xs font-mono disabled:opacity-50"
          >
            {busy ? "Building..." : plan ? "Re-build plan" : "Build my plan"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-[var(--red)] font-mono">{error}</p>}

      {!plan ? (
        <p className="text-sm text-[var(--muted)] italic">
          Click <em>Build my plan</em> — Opus 4.7 will design a 4-week sequence from your cognitive profile and recurring patterns.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="font-serif text-lg">{plan.goal}</p>
          <p className="font-mono text-xs text-[var(--muted)]">
            {plan.weeklyHours}h/week · 4 weeks
          </p>

          <div className="grid lg:grid-cols-2 gap-3">
            {plan.weeks.map((w) => (
              <div key={w.weekNumber} className="paper-card p-4 bg-[var(--paper2)]">
                <div className="flex justify-between items-baseline">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
                    Week {w.weekNumber}
                  </p>
                  <p className="font-mono text-[10px] text-[var(--muted)]">
                    {w.dailyDrills.reduce((acc, d) => acc + d.minutes, 0)} min/wk
                  </p>
                </div>
                <p className="font-serif text-xl mt-1">{w.focus}</p>
                <p className="text-sm text-[var(--muted)] italic mt-1">{w.rationale}</p>
                <ul className="mt-3 space-y-1 text-sm">
                  {w.dailyDrills.map((d) => (
                    <li key={`${w.weekNumber}-${d.day}-${d.task.slice(0, 12)}`} className="flex justify-between gap-2">
                      <span>
                        <span className="font-mono text-[10px] text-[var(--muted)] mr-2">
                          {d.day}
                        </span>
                        {d.task}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--muted)] whitespace-nowrap">
                        {d.minutes}m
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs font-mono text-[var(--gold)] border-t border-[var(--border)] pt-2">
                  ✓ Success signal: <span className="not-italic text-[var(--ink)]">{w.successSignal}</span>
                </p>
              </div>
            ))}
          </div>

          {plan.guardrails.length > 0 && (
            <div className="rounded border border-[var(--red)]/30 bg-[var(--red)]/5 p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--red)] mb-1">
                Guardrails
              </p>
              <ul className="space-y-1 text-sm">
                {plan.guardrails.map((g) => (
                  <li key={g} className="flex gap-2">
                    <span className="text-[var(--red)]">✗</span>
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
