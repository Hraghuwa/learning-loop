import { RadarChart } from "@/components/profile/radar-chart";
import { InsightPanel } from "@/components/profile/insight-panel";
import { StudyPlanPanel } from "@/components/profile/study-plan-panel";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Insight = Parameters<typeof InsightPanel>[0]["initial"]["insight"];

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [
    { data: profileRow },
    { data: cp },
    { data: sessions },
    { data: peers },
    { data: insightRow },
    { data: planRow },
  ] = await Promise.all([
    db.from("profiles").select("name, target_percentile").eq("id", user.id).single(),
    db.from("cognitive_profiles").select("*").eq("user_id", user.id).single(),
    db
      .from("sessions")
      .select("error_type, created_at, is_correct, question_id, questions(subtopic)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40),
    db.from("improvement_tracking").select("percentile_delta").limit(200),
    db
      .from("cognitive_insights")
      .select("payload, generated_at, sessions_analyzed")
      .eq("user_id", user.id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("study_plans")
      .select("id, payload, target_percentile, weekly_hours, generated_at")
      .eq("user_id", user.id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const profile = cp as
    | {
        percentile_estimate?: number;
        quant_score?: number;
        varc_score?: number;
        dilr_score?: number;
        reasoning_score?: number;
        speed_score?: number;
        accuracy_score?: number;
        total_sessions?: number;
      }
    | null;

  const sessionRows = (sessions ?? []) as Array<{ error_type: string | null }>;
  const peerRows = (peers ?? []) as Array<{ percentile_delta: number }>;
  const peerAvg =
    peerRows.length > 0
      ? peerRows.reduce((a, b) => a + Number(b.percentile_delta), 0) / peerRows.length
      : 0;

  const errors = Object.entries(
    sessionRows.reduce((acc: Record<string, number>, s) => {
      if (s.error_type) acc[s.error_type] = (acc[s.error_type] || 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-baseline flex-wrap gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
            Cognitive intelligence
          </p>
          <h1 className="font-serif text-4xl mt-1">Cognitive Fingerprint</h1>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Percentile estimate
          </p>
          <p className="font-serif text-4xl">{Number(profile?.percentile_estimate ?? 50).toFixed(0)}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="paper-card p-5 overflow-auto">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-2">
            Six-axis profile
          </p>
          <RadarChart
            labels={["Quant", "VARC", "DILR", "Reasoning", "Speed", "Accuracy"]}
            values={[
              Number(profile?.quant_score ?? 5),
              Number(profile?.varc_score ?? 5),
              Number(profile?.dilr_score ?? 5),
              Number(profile?.reasoning_score ?? 5),
              Number(profile?.speed_score ?? 5),
              Number(profile?.accuracy_score ?? 5),
            ]}
          />
        </div>
        <div className="paper-card p-5 space-y-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-2">
              Top error patterns
            </p>
            {errors.length === 0 ? (
              <p className="text-sm text-[var(--muted)] italic">No data yet.</p>
            ) : (
              <div className="space-y-2">
                {errors.map(([k, v]) => (
                  <div key={k}>
                    <div className="flex justify-between text-sm">
                      <span>{k}</span>
                      <span className="font-mono text-xs">{v}×</span>
                    </div>
                    <div className="h-1.5 w-full rounded bg-[var(--paper2)] mt-1">
                      <div
                        className="h-1.5 rounded bg-[var(--gold)]"
                        style={{ width: `${Math.min(100, v * 20)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
              Anonymous peer benchmark
            </p>
            <p className="text-sm text-[var(--muted)] mt-1">
              Avg uplift across our cohort: <strong className="text-[var(--ink)]">+{peerAvg.toFixed(1)}</strong> percentile.
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
              Total sessions analysed
            </p>
            <p className="font-serif text-2xl mt-1">{Number(profile?.total_sessions ?? 0)}</p>
          </div>
        </div>
      </div>

      <InsightPanel
        initial={{
          insight: (insightRow?.payload as Insight) ?? null,
          generatedAt: insightRow?.generated_at ?? null,
          sessionsAnalyzed: Number(insightRow?.sessions_analyzed ?? 0),
          cached: !!insightRow,
        }}
      />

      <StudyPlanPanel
        saved={planRow ?? null}
        defaultTargetPercentile={Number(profileRow?.target_percentile ?? 95)}
      />
    </div>
  );
}
