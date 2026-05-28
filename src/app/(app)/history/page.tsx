import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type SearchParams = { topic?: string; outcome?: string };

export default async function HistoryPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const sp = ((await searchParams) ?? {}) as SearchParams;
  const topicFilter = sp.topic ?? "";
  const outcomeFilter = sp.outcome ?? "";

  let query = db
    .from("sessions")
    .select(
      "id, is_correct, error_type, reasoning_score, created_at, ai_diagnosis, questions(topic, subtopic)",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (outcomeFilter === "correct") query = query.eq("is_correct", true);
  if (outcomeFilter === "wrong") query = query.eq("is_correct", false);

  const { data: sessions } = await query;
  let rows = ((sessions ?? []) as Array<{
    id: string;
    is_correct: boolean;
    reasoning_score: number | null;
    error_type: string | null;
    created_at: string;
    ai_diagnosis: string | null;
    questions: { topic: string; subtopic: string } | null;
  }>);

  if (topicFilter) rows = rows.filter((r) => r.questions?.topic === topicFilter);

  const filterLink = (key: keyof SearchParams, value: string) => {
    const next: Record<string, string> = { ...sp };
    if (next[key] === value) delete next[key];
    else next[key] = value;
    const qs = new URLSearchParams(next).toString();
    return `/history${qs ? `?${qs}` : ""}`;
  };

  const chip = (label: string, active: boolean, href: string) => (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-[11px] font-mono border transition-colors ${
        active
          ? "border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)]"
          : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--gold)]"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <h1 className="font-serif text-4xl">Session history</h1>
        <p className="font-mono text-xs text-[var(--muted)]">
          {rows.length} attempt{rows.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {chip("Quantitative", topicFilter === "Quantitative", filterLink("topic", "Quantitative"))}
        {chip("VARC", topicFilter === "VARC", filterLink("topic", "VARC"))}
        {chip("DILR", topicFilter === "DILR", filterLink("topic", "DILR"))}
        <span className="w-px h-6 bg-[var(--border)] mx-1" />
        {chip("Correct only", outcomeFilter === "correct", filterLink("outcome", "correct"))}
        {chip("Wrong only", outcomeFilter === "wrong", filterLink("outcome", "wrong"))}
        {(topicFilter || outcomeFilter) && (
          <Link href="/history" className="text-[11px] font-mono text-[var(--red)] underline ml-2">
            Clear filters
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="paper-card p-6 text-[var(--muted)] italic">
          No attempts in this view yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map((s) => (
            <Link
              key={s.id}
              href={`/history/${s.id}`}
              className="paper-card p-4 hover:border-[var(--gold)] flex items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="font-mono text-[10px] text-[var(--muted)] uppercase tracking-widest">
                  {new Date(s.created_at).toLocaleString()}
                </p>
                <p className="mt-1">
                  <span className="text-[var(--muted)]">{s.questions?.topic} ·</span> {s.questions?.subtopic}
                </p>
                {s.ai_diagnosis && (
                  <p className="mt-1 text-sm text-[var(--muted)] line-clamp-1 italic">
                    {s.ai_diagnosis}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className={s.is_correct ? "text-[var(--green)]" : "text-[var(--red)]"}>
                  {s.is_correct ? "Correct" : s.error_type || "Wrong"}
                </p>
                <p className="text-sm font-mono text-[var(--muted)]">
                  Reasoning {s.reasoning_score ?? 0}/10
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
