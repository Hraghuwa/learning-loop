"use client";

import { useState } from "react";

type Insight = {
  headline: string;
  summary: string;
  recurringPatterns: { name: string; evidence: string; severity: "low" | "medium" | "high" }[];
  strengths: string[];
  trajectory: "rising" | "plateau" | "regressing" | "early";
  trajectoryReason: string;
  projectedPercentile: number;
  topRecommendations: { action: string; why: string; estimatedDays: number }[];
};

type Props = {
  initial: {
    insight: Insight | null;
    generatedAt: string | null;
    sessionsAnalyzed: number;
    cached: boolean;
  };
};

const trajectoryStyles: Record<Insight["trajectory"], { label: string; cls: string }> = {
  rising: { label: "Rising", cls: "text-[var(--green)]" },
  plateau: { label: "Plateau", cls: "text-[var(--gold)]" },
  regressing: { label: "Regressing", cls: "text-[var(--red)]" },
  early: { label: "Building baseline", cls: "text-[var(--muted)]" },
};

const severityCls: Record<"low" | "medium" | "high", string> = {
  low: "bg-[var(--blue)]/10 text-[var(--blue)] border-[var(--blue)]/30",
  medium: "bg-[var(--gold)]/10 text-[var(--gold)] border-[var(--gold)]/30",
  high: "bg-[var(--red)]/10 text-[var(--red)] border-[var(--red)]/30",
};

export function InsightPanel({ initial }: Props) {
  const [insight, setInsight] = useState<Insight | null>(initial.insight);
  const [meta, setMeta] = useState({
    generatedAt: initial.generatedAt,
    sessionsAnalyzed: initial.sessionsAnalyzed,
    cached: initial.cached,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/insights/profile?force=1");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setInsight(data.insight);
      setMeta({
        generatedAt: data.generatedAt ?? new Date().toISOString(),
        sessionsAnalyzed: data.sessionsAnalyzed ?? 0,
        cached: !!data.cached,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate insight.");
    } finally {
      setBusy(false);
    }
  };

  if (!insight) {
    return (
      <div className="paper-card p-5 space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
          Cognitive narrative
        </p>
        <p className="text-sm text-[var(--muted)] italic">
          We&apos;ll generate a deep, multi-attempt synthesis from Opus 4.7 once you have at least 5 sessions.
        </p>
      </div>
    );
  }

  const traj = trajectoryStyles[insight.trajectory];

  return (
    <div className="paper-card p-6 space-y-5 border-l-4 border-l-[var(--blue)]">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Opus 4.7 cognitive synthesis
          </p>
          <h2 className="font-serif text-2xl mt-1">{insight.headline}</h2>
        </div>
        <button
          onClick={refresh}
          disabled={busy}
          className="rounded border border-[var(--border)] px-3 py-1.5 text-xs font-mono hover:border-[var(--gold)] disabled:opacity-50"
        >
          {busy ? "Synthesising..." : "Re-run synthesis"}
        </button>
      </div>

      <p className="leading-relaxed">{insight.summary}</p>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="paper-card p-3 bg-[var(--paper2)]">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">Trajectory</p>
          <p className={`font-serif text-2xl mt-1 ${traj.cls}`}>{traj.label}</p>
          <p className="text-xs text-[var(--muted)] mt-1">{insight.trajectoryReason}</p>
        </div>
        <div className="paper-card p-3 bg-[var(--paper2)]">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Projected percentile (6w)
          </p>
          <p className="font-serif text-2xl mt-1">{insight.projectedPercentile.toFixed(0)}</p>
          <p className="text-xs text-[var(--muted)] mt-1">If trajectory holds.</p>
        </div>
        <div className="paper-card p-3 bg-[var(--paper2)]">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Sessions analysed
          </p>
          <p className="font-serif text-2xl mt-1">{meta.sessionsAnalyzed}</p>
          <p className="text-xs text-[var(--muted)] mt-1">
            {meta.generatedAt ? `Updated ${new Date(meta.generatedAt).toLocaleString()}` : ""}
          </p>
        </div>
      </div>

      {insight.recurringPatterns.length > 0 && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-2">
            Recurring cognitive habits
          </p>
          <div className="grid gap-2">
            {insight.recurringPatterns.map((p) => (
              <div
                key={`${p.name}-${p.evidence.slice(0, 16)}`}
                className={`rounded border p-3 ${severityCls[p.severity]}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <p className="font-serif text-lg leading-tight">{p.name}</p>
                  <span className="font-mono text-[10px] uppercase tracking-widest opacity-80">
                    {p.severity}
                  </span>
                </div>
                <p className="text-sm mt-1 opacity-90">{p.evidence}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {insight.strengths.length > 0 && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-2">
            What you do well
          </p>
          <ul className="space-y-1 text-sm">
            {insight.strengths.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="text-[var(--green)]">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-2">
          Top three actions
        </p>
        <div className="grid gap-2">
          {insight.topRecommendations.map((r, i) => (
            <div key={`${i}-${r.action.slice(0, 20)}`} className="paper-card p-3">
              <div className="flex justify-between items-start gap-2">
                <p className="font-serif text-lg">{r.action}</p>
                <span className="font-mono text-[10px] text-[var(--muted)] whitespace-nowrap">
                  ~{r.estimatedDays}d
                </span>
              </div>
              <p className="text-sm text-[var(--muted)] italic mt-1">{r.why}</p>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-[var(--red)] font-mono">{error}</p>}
    </div>
  );
}
