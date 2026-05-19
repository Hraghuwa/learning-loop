import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function PracticePage() {
  const supabase = await createServerSupabaseClient();
  const { data: questions } = await supabase
    .from("questions")
    .select("id, topic, subtopic, difficulty")
    .limit(20);
  const rows = (questions ?? []) as Array<{
    id: string;
    topic: string;
    subtopic: string;
    difficulty: string;
  }>;

  return (
    <div>
      <h1 className="font-serif text-4xl mb-4">Choose a question</h1>
      <div className="grid gap-3">
        {rows.map((q) => (
          <Link key={q.id} href={`/practice/${q.id}`} className="paper-card p-4 hover:border-[var(--gold)]">
            <p className="font-mono text-sm text-[var(--muted)]">{q.topic} / {q.subtopic}</p>
            <p>Difficulty: {q.difficulty}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
