import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function HistoryPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, is_correct, error_type, reasoning_score, created_at, questions(topic, subtopic)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const rows = (sessions ?? []) as Array<{
    id: string;
    is_correct: boolean;
    reasoning_score: number | null;
    created_at: string;
    questions: { topic: string; subtopic: string } | null;
  }>;

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl">Session History</h1>
      {rows.map((s) => (
        <div key={s.id} className="paper-card p-4 flex items-center justify-between">
          <div>
            <p>{s.questions?.topic} / {s.questions?.subtopic}</p>
            <p className="text-sm text-[var(--muted)]">{new Date(s.created_at).toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className={s.is_correct ? "text-[var(--green)]" : "text-[var(--red)]"}>{s.is_correct ? "Correct" : "Needs review"}</p>
            <p className="text-sm font-mono">Reasoning {s.reasoning_score ?? 0}/10</p>
          </div>
        </div>
      ))}
    </div>
  );
}
