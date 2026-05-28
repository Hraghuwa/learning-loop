import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Question = {
  id: string;
  topic: string;
  subtopic: string;
  difficulty: string;
  question_text: string;
};

type ReviewRow = {
  question_id: string;
  due_at: string;
  interval_days: number;
  questions: Question | null;
};

type Mastery = { topic: string; subtopic: string; mastery: number };

const TOPIC_KEYS = {
  Quantitative: "quant_score",
  VARC: "varc_score",
  DILR: "dilr_score",
} as const;

export default async function PracticePage() {
  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const nowIso = new Date().toISOString();

  const [{ data: dueRaw }, { data: cogRaw }, { data: masteryRaw }] = await Promise.all([
    db
      .from("review_queue")
      .select("question_id, due_at, interval_days, questions(id, topic, subtopic, difficulty, question_text)")
      .eq("user_id", user.id)
      .lte("due_at", nowIso)
      .order("due_at", { ascending: true })
      .limit(8),
    db
      .from("cognitive_profiles")
      .select("quant_score, varc_score, dilr_score")
      .eq("user_id", user.id)
      .single(),
    db
      .from("subtopic_mastery")
      .select("topic, subtopic, mastery")
      .eq("user_id", user.id),
  ]);

  const due = ((dueRaw ?? []) as ReviewRow[])
    .filter((r) => r.questions)
    .map((r) => ({ ...(r.questions as Question), due_at: r.due_at, interval_days: r.interval_days }));

  const cog = cogRaw ?? { quant_score: 5, varc_score: 5, dilr_score: 5 };
  const mastery = (masteryRaw ?? []) as Mastery[];

  const topicScores = (Object.entries(TOPIC_KEYS) as Array<[keyof typeof TOPIC_KEYS, string]>).map(
    ([t, k]) => ({ topic: t, score: Number(cog[k as keyof typeof cog] ?? 5) }),
  );
  topicScores.sort((a, b) => a.score - b.score);
  const weakestTopic = topicScores[0]?.topic ?? "Quantitative";

  const subsInWeak = mastery.filter((m) => m.topic === weakestTopic);
  subsInWeak.sort((a, b) => a.mastery - b.mastery);
  const weakSubtopics = subsInWeak.slice(0, 3).map((m) => m.subtopic);

  // Recommended question pool — exclude due ones and recently correct ones.
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const { data: recentRaw } = await db
    .from("sessions")
    .select("question_id, is_correct")
    .eq("user_id", user.id)
    .gte("created_at", since);
  const recentlyCorrect = new Set(
    ((recentRaw ?? []) as Array<{ question_id: string; is_correct: boolean }>)
      .filter((r) => r.is_correct)
      .map((r) => r.question_id),
  );
  const dueIds = new Set(due.map((q) => q.id));

  let recCandidates: Question[] = [];
  if (weakSubtopics.length) {
    const { data: rows } = await db
      .from("questions")
      .select("id, topic, subtopic, difficulty, question_text")
      .eq("topic", weakestTopic)
      .in("subtopic", weakSubtopics)
      .limit(20);
    recCandidates = (rows ?? []) as Question[];
  }
  if (recCandidates.length < 6) {
    const { data: rows2 } = await db
      .from("questions")
      .select("id, topic, subtopic, difficulty, question_text")
      .eq("topic", weakestTopic)
      .limit(15);
    recCandidates = recCandidates.concat((rows2 ?? []) as Question[]);
  }
  if (recCandidates.length < 6) {
    const { data: rows3 } = await db
      .from("questions")
      .select("id, topic, subtopic, difficulty, question_text")
      .limit(15);
    recCandidates = recCandidates.concat((rows3 ?? []) as Question[]);
  }
  const seen = new Set<string>(dueIds);
  const recommendations = recCandidates
    .filter((q) => {
      if (seen.has(q.id)) return false;
      if (recentlyCorrect.has(q.id)) return false;
      seen.add(q.id);
      return true;
    })
    .slice(0, 8);

  // Browse-by-topic groupings for the explorer.
  const { data: allQs } = await db
    .from("questions")
    .select("id, topic, subtopic, difficulty, question_text")
    .order("topic")
    .order("subtopic")
    .limit(120);
  const byTopic: Record<string, Question[]> = {};
  for (const q of (allQs ?? []) as Question[]) {
    (byTopic[q.topic] ||= []).push(q);
  }

  const reasonBadge = (label: string, color: string) => (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest ${color}`}>
      {label}
    </span>
  );

  return (
    <div className="space-y-10">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">Today&rsquo;s Loop</p>
        <h1 className="font-serif text-4xl mt-1">Practice that targets your weakest patterns</h1>
        <p className="text-[var(--muted)] mt-2 max-w-2xl">
          Your weakest area right now is <span className="text-[var(--gold)] font-medium">{weakestTopic}</span>.
          Spaced repetition reviews come first; the rest is curated to push your reasoning where it&rsquo;s thinnest.
        </p>
      </div>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-serif text-2xl">Due for Review</h2>
          <p className="font-mono text-xs text-[var(--muted)]">{due.length} item{due.length === 1 ? "" : "s"}</p>
        </div>
        {due.length === 0 ? (
          <div className="paper-card p-6 text-[var(--muted)] italic">
            Nothing due. Every loop you complete schedules its next review automatically.
          </div>
        ) : (
          <div className="grid gap-3">
            {due.map((q) => (
              <Link
                key={q.id}
                href={`/practice/${q.id}`}
                className="paper-card p-4 hover:border-[var(--red)] transition-colors flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex gap-2 items-center mb-1">
                    {reasonBadge("Due review", "bg-[var(--red)]/10 text-[var(--red)]")}
                    <span className="font-mono text-[10px] text-[var(--muted)]">
                      {q.topic} · {q.subtopic} · {q.difficulty}
                    </span>
                  </div>
                  <p className="text-sm line-clamp-2 text-[var(--ink)]">{q.question_text}</p>
                </div>
                <span className="text-[var(--gold)] font-mono text-xs whitespace-nowrap">
                  Resume →
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-serif text-2xl">Recommended for You</h2>
          <p className="font-mono text-xs text-[var(--muted)]">
            From {weakestTopic}{weakSubtopics.length ? ` · ${weakSubtopics.join(", ")}` : ""}
          </p>
        </div>
        <div className="grid gap-3">
          {recommendations.map((q) => (
            <Link
              key={q.id}
              href={`/practice/${q.id}`}
              className="paper-card p-4 hover:border-[var(--gold)] transition-colors flex items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex gap-2 items-center mb-1">
                  {reasonBadge("Targets weak area", "bg-[var(--gold)]/10 text-[var(--gold)]")}
                  <span className="font-mono text-[10px] text-[var(--muted)]">
                    {q.topic} · {q.subtopic} · {q.difficulty}
                  </span>
                </div>
                <p className="text-sm line-clamp-2 text-[var(--ink)]">{q.question_text}</p>
              </div>
              <span className="text-[var(--gold)] font-mono text-xs whitespace-nowrap">Start →</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-serif text-2xl">Browse the Bank</h2>
          <Link href="/practice/mock" className="font-mono text-xs text-[var(--gold)] hover:underline">
            Take a timed mock test →
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {Object.entries(byTopic).map(([topic, qs]) => (
            <div key={topic} className="paper-card p-4">
              <p className="font-serif text-lg mb-2">{topic}</p>
              <div className="space-y-1">
                {qs.slice(0, 8).map((q) => (
                  <Link
                    key={q.id}
                    href={`/practice/${q.id}`}
                    className="block text-xs text-[var(--muted)] hover:text-[var(--gold)] truncate"
                  >
                    {q.subtopic} · {q.difficulty}
                  </Link>
                ))}
                {qs.length > 8 && (
                  <p className="text-[10px] font-mono text-[var(--muted)]">+{qs.length - 8} more</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
