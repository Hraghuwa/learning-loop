import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MockLauncher } from "@/components/practice/mock-launcher";

export default async function MockTestsIndex() {
  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: tests } = await db
    .from("mock_tests")
    .select("id, status, started_at, completed_at, score, duration_seconds, question_ids")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(20);

  const rows = ((tests ?? []) as Array<{
    id: string;
    status: string;
    started_at: string;
    completed_at: string | null;
    score: number | null;
    duration_seconds: number;
    question_ids: string[];
  }>);

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">Exam Mode</p>
        <h1 className="font-serif text-4xl mt-1">Mock tests</h1>
        <p className="text-[var(--muted)] mt-2 max-w-2xl">
          Timed practice without AI mid-question. Build your stamina and test-day rhythm; the diagnosis comes after.
        </p>
      </div>

      <MockLauncher />

      <section>
        <h2 className="font-serif text-2xl mb-3">Past tests</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--muted)] italic">No tests yet.</p>
        ) : (
          <div className="grid gap-3">
            {rows.map((t) => (
              <Link
                key={t.id}
                href={`/practice/mock/${t.id}`}
                className="paper-card p-4 flex justify-between items-center hover:border-[var(--gold)]"
              >
                <div>
                  <p className="font-mono text-xs text-[var(--muted)]">
                    {new Date(t.started_at).toLocaleString()}
                  </p>
                  <p>
                    {t.question_ids.length} questions · {Math.round(t.duration_seconds / 60)} min
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={
                      t.status === "completed"
                        ? "text-[var(--green)]"
                        : t.status === "abandoned"
                          ? "text-[var(--red)]"
                          : "text-[var(--gold)]"
                    }
                  >
                    {t.status === "completed"
                      ? `${t.score}/${t.question_ids.length}`
                      : t.status === "abandoned"
                        ? "Abandoned"
                        : "Resume →"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
