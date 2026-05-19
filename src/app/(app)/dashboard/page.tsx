import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
  const profileRow = profile as { streak_count?: number } | null;
  const { data: sessions } = await supabase
    .from("sessions")
    .select("is_correct, reasoning_score")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(10);
  const sessionRows = (sessions ?? []) as { is_correct: boolean; reasoning_score: number | null }[];
  const accuracy = sessionRows.length ? (sessionRows.filter((s) => s.is_correct).length / sessionRows.length) * 100 : 0;
  const avgReason = sessionRows.length
    ? sessionRows.reduce((acc, s) => acc + (s.reasoning_score ?? 0), 0) / sessionRows.length
    : 0;

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-4xl">Your Thinking Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="paper-card p-4"><p className="font-mono text-xs text-[var(--muted)]">Streak</p><p className="font-serif text-3xl">{profileRow?.streak_count ?? 0}</p></div>
        <div className="paper-card p-4"><p className="font-mono text-xs text-[var(--muted)]">Reasoning</p><p className="font-serif text-3xl">{avgReason.toFixed(1)}/10</p></div>
        <div className="paper-card p-4"><p className="font-mono text-xs text-[var(--muted)]">Accuracy</p><p className="font-serif text-3xl">{accuracy.toFixed(0)}%</p></div>
      </div>
      <Link href="/practice" className="inline-block rounded bg-[var(--gold)] px-5 py-3 text-white">Start Practice</Link>
    </div>
  );
}
