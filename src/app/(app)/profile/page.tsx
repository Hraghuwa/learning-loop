import { RadarChart } from "@/components/profile/radar-chart";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: cp } = await supabase.from("cognitive_profiles").select("*").eq("user_id", user!.id).single();
  const profile = cp as {
    percentile_estimate?: number;
    quant_score?: number;
    varc_score?: number;
    dilr_score?: number;
    reasoning_score?: number;
    speed_score?: number;
    accuracy_score?: number;
  } | null;
  const { data: sessions } = await supabase
    .from("sessions")
    .select("error_type, created_at, is_correct, question_id, questions(subtopic)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const { data: peers } = await supabase
    .from("improvement_tracking")
    .select("percentile_delta")
    .limit(200);
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
  ).slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl">Cognitive Fingerprint</h1>
      <div className="paper-card p-5">
        <p>Percentile Estimate: <span className="font-serif text-3xl">{profile?.percentile_estimate ?? 50}</span></p>
      </div>
      <div className="paper-card p-5 overflow-auto">
        <RadarChart
          labels={["Quant", "VARC", "DILR", "Reasoning", "Speed", "Accuracy"]}
          values={[
            profile?.quant_score ?? 5,
            profile?.varc_score ?? 5,
            profile?.dilr_score ?? 5,
            profile?.reasoning_score ?? 5,
            profile?.speed_score ?? 5,
            profile?.accuracy_score ?? 5,
          ]}
        />
      </div>
      <div className="paper-card p-5">
        <h2 className="font-serif text-2xl mb-3">Top Error Patterns</h2>
        {errors.map(([k, v]) => (
          <div key={k} className="mb-2">
            <p className="text-sm">{k}</p>
            <div className="h-2 w-full rounded bg-[var(--paper2)]">
              <div className="h-2 rounded bg-[var(--gold)]" style={{ width: `${Math.min(100, v * 20)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="paper-card p-5">
        <h2 className="font-serif text-2xl mb-3">Peer Comparison</h2>
        <p className="text-sm text-[var(--muted)]">
          Avg benchmark uplift: +{peerAvg.toFixed(1)} percentile
        </p>
      </div>
    </div>
  );
}
