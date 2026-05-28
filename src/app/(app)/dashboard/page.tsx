import { Suspense } from "react";
import Link from "next/link";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { UpgradeBanner } from "@/components/dashboard/upgrade-banner";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const dayLabel = (d: Date) =>
  d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3);

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const since7 = new Date(Date.now() - 7 * 86400000).toISOString();

  const [
    { data: profile },
    { data: cog },
    { data: sessions7 },
    { data: dueRows },
    { data: mastery },
    { data: recentSessions },
  ] = await Promise.all([
    db.from("profiles").select("name, streak_count, xp, plan").eq("id", user.id).single(),
    db.from("cognitive_profiles").select("*").eq("user_id", user.id).single(),
    db
      .from("sessions")
      .select("created_at, is_correct, reasoning_score, error_type")
      .eq("user_id", user.id)
      .gte("created_at", since7)
      .order("created_at", { ascending: true }),
    db
      .from("review_queue")
      .select("question_id")
      .eq("user_id", user.id)
      .lte("due_at", new Date().toISOString())
      .limit(50),
    db.from("subtopic_mastery").select("topic, subtopic, mastery").eq("user_id", user.id),
    db
      .from("sessions")
      .select("id, is_correct, reasoning_score, error_type, created_at, questions(topic, subtopic)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const profileRow = profile ?? { streak_count: 0, xp: 0, plan: "free", name: "" };
  const cogRow = cog ?? { percentile_estimate: 50 };
  const sessions = (sessions7 ?? []) as Array<{
    created_at: string;
    is_correct: boolean;
    reasoning_score: number | null;
    error_type: string | null;
  }>;
  const masteryRows = (mastery ?? []) as Array<{ topic: string; subtopic: string; mastery: number }>;
  const recents = (recentSessions ?? []) as Array<{
    id: string;
    is_correct: boolean;
    reasoning_score: number | null;
    error_type: string | null;
    created_at: string;
    questions: { topic: string; subtopic: string } | null;
  }>;

  // Build 7-day trend buckets (reasoning score average per day).
  const buckets: Record<string, { sum: number; count: number; correct: number; date: Date }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    buckets[key] = { sum: 0, count: 0, correct: 0, date: d };
  }
  for (const s of sessions) {
    const key = new Date(s.created_at).toISOString().split("T")[0];
    if (!buckets[key]) continue;
    buckets[key].sum += Number(s.reasoning_score ?? 0);
    buckets[key].count += 1;
    if (s.is_correct) buckets[key].correct += 1;
  }
  const reasoningTrend = Object.values(buckets).map((b) => ({
    day: dayLabel(b.date),
    value: b.count > 0 ? b.sum / b.count : 0,
  }));
  const accuracyTrend = Object.values(buckets).map((b) => ({
    day: dayLabel(b.date),
    value: b.count > 0 ? (b.correct / b.count) * 10 : 0,
  }));

  // KPIs.
  const total7 = sessions.length;
  const accuracy7 = total7 ? (sessions.filter((s) => s.is_correct).length / total7) * 100 : 0;
  const avgReason7 = total7
    ? sessions.reduce((a, s) => a + Number(s.reasoning_score ?? 0), 0) / total7
    : 0;
  const dueCount = (dueRows ?? []).length;

  // Weakest subtopics.
  masteryRows.sort((a, b) => a.mastery - b.mastery);
  const weakest = masteryRows.slice(0, 4);

  // Top error types in last 7 days.
  const errorCounts = sessions.reduce<Record<string, number>>((acc, s) => {
    if (s.error_type) acc[s.error_type] = (acc[s.error_type] || 0) + 1;
    return acc;
  }, {});
  const topErrors = Object.entries(errorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="space-y-8">
      <Suspense fallback={null}>
        <UpgradeBanner />
      </Suspense>
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
            Welcome back{profileRow.name ? `, ${profileRow.name.split(" ")[0]}` : ""}
          </p>
          <h1 className="font-serif text-4xl mt-1">Your Thinking Dashboard</h1>
        </div>
        <div className="flex gap-3">
          {dueCount > 0 && (
            <Link
              href="/practice"
              className="rounded bg-[var(--red)]/10 border border-[var(--red)]/30 text-[var(--red)] px-4 py-2 text-sm font-mono"
            >
              {dueCount} due review{dueCount === 1 ? "" : "s"} →
            </Link>
          )}
          <Link
            href="/practice"
            className="rounded bg-[var(--gold)] px-5 py-2 text-white font-mono text-sm hover:bg-[var(--gold-dark)]"
          >
            Start practice →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Streak" value={`${profileRow.streak_count ?? 0}`} suffix="days" />
        <Kpi
          label="7-day accuracy"
          value={`${accuracy7.toFixed(0)}%`}
          suffix={`${total7} attempt${total7 === 1 ? "" : "s"}`}
        />
        <Kpi label="Reasoning" value={avgReason7.toFixed(1)} suffix="/10 avg" />
        <Kpi label="Percentile estimate" value={`${Number(cogRow.percentile_estimate ?? 50).toFixed(0)}`} suffix="th" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="paper-card p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Reasoning quality (last 7 days)
          </p>
          <TrendChart data={reasoningTrend} maxValue={10} label="" />
        </div>
        <div className="paper-card p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Accuracy trend (last 7 days, scaled to 10)
          </p>
          <TrendChart data={accuracyTrend} maxValue={10} label="" />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="paper-card p-5">
          <h2 className="font-serif text-2xl mb-3">Weakest subtopics</h2>
          {weakest.length === 0 ? (
            <p className="text-sm text-[var(--muted)] italic">
              We&apos;ll surface your weakest areas after a few attempts.
            </p>
          ) : (
            <div className="space-y-3">
              {weakest.map((m) => (
                <div key={`${m.topic}-${m.subtopic}`}>
                  <div className="flex justify-between text-sm">
                    <span>
                      <span className="text-[var(--muted)]">{m.topic} ·</span> {m.subtopic}
                    </span>
                    <span className="font-mono text-xs">{Number(m.mastery).toFixed(1)}/10</span>
                  </div>
                  <div className="h-1.5 w-full rounded bg-[var(--paper2)] mt-1">
                    <div
                      className="h-1.5 rounded bg-[var(--gold)]"
                      style={{ width: `${(Math.max(0, Math.min(10, Number(m.mastery))) / 10) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="paper-card p-5">
          <h2 className="font-serif text-2xl mb-3">Top error patterns (7 days)</h2>
          {topErrors.length === 0 ? (
            <p className="text-sm text-[var(--muted)] italic">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {topErrors.map(([err, count]) => (
                <div key={err}>
                  <div className="flex justify-between text-sm">
                    <span>{err}</span>
                    <span className="font-mono text-xs">{count}×</span>
                  </div>
                  <div className="h-1.5 w-full rounded bg-[var(--paper2)] mt-1">
                    <div
                      className="h-1.5 rounded bg-[var(--red)]"
                      style={{ width: `${Math.min(100, count * 20)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="paper-card p-5">
        <div className="flex justify-between items-baseline mb-3">
          <h2 className="font-serif text-2xl">Recent activity</h2>
          <Link href="/history" className="font-mono text-xs text-[var(--gold)] hover:underline">
            View all →
          </Link>
        </div>
        {recents.length === 0 ? (
          <p className="text-sm text-[var(--muted)] italic">No attempts yet.</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {recents.map((s) => (
              <Link
                key={s.id}
                href={`/history/${s.id}`}
                className="flex justify-between py-3 text-sm hover:bg-[var(--paper2)] -mx-2 px-2 rounded"
              >
                <div>
                  <p>
                    <span className="text-[var(--muted)]">{s.questions?.topic} ·</span> {s.questions?.subtopic}
                  </p>
                  <p className="font-mono text-[10px] text-[var(--muted)]">
                    {new Date(s.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className={s.is_correct ? "text-[var(--green)]" : "text-[var(--red)]"}>
                    {s.is_correct ? "Correct" : s.error_type || "Needs review"}
                  </p>
                  <p className="font-mono text-[10px] text-[var(--muted)]">
                    Reasoning {s.reasoning_score ?? 0}/10
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="paper-card p-4">
      <p className="font-mono text-[10px] text-[var(--muted)] uppercase tracking-widest">{label}</p>
      <p className="font-serif text-3xl mt-1">{value}</p>
      {suffix && <p className="font-mono text-[10px] text-[var(--muted)] mt-0.5">{suffix}</p>}
    </div>
  );
}
