import Link from "next/link";
import { notFound } from "next/navigation";
import { TutorThread } from "@/components/coach/tutor-thread";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Session = {
  id: string;
  is_correct: boolean;
  selected_option: number | null;
  error_type: string | null;
  reasoning_score: number | null;
  reasoning_text: string | null;
  reasoning_input_method: string | null;
  ai_diagnosis: string | null;
  ai_correction: string | null;
  ai_pattern_alert: string | null;
  ai_next_topic: string | null;
  time_taken_seconds: number | null;
  created_at: string;
  questions:
    | {
        id: string;
        topic: string;
        subtopic: string;
        difficulty: string;
        question_text: string;
        options: string[];
        correct_index: number;
        explanation: string | null;
      }
    | null;
};

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { id } = await params;
  const { data: sess } = await db
    .from("sessions")
    .select(
      "id, is_correct, selected_option, error_type, reasoning_score, reasoning_text, reasoning_input_method, ai_diagnosis, ai_correction, ai_pattern_alert, ai_next_topic, time_taken_seconds, created_at, questions(id, topic, subtopic, difficulty, question_text, options, correct_index, explanation)",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  const session = sess as Session | null;
  if (!session || !session.questions) notFound();

  const q = session.questions;
  const picked = session.selected_option;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link href="/history" className="font-mono text-xs text-[var(--muted)] hover:text-[var(--gold)]">
          ← Back to history
        </Link>
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
          {new Date(session.created_at).toLocaleString()}
        </p>
      </div>

      <div className="paper-card p-4 flex flex-wrap items-center gap-2 text-sm font-mono text-[var(--muted)]">
        <span className="rounded bg-[var(--blue)]/10 px-2 py-1 text-[var(--blue)]">{q.topic}</span>
        <span className="rounded bg-[var(--paper2)] px-2 py-1">{q.subtopic}</span>
        <span className="rounded bg-[var(--paper2)] px-2 py-1">{q.difficulty}</span>
        <span
          className={`ml-auto rounded px-2 py-1 ${session.is_correct ? "bg-[var(--green)]/10 text-[var(--green)]" : "bg-[var(--red)]/10 text-[var(--red)]"}`}
        >
          {session.is_correct ? "Correct" : "Incorrect"}
        </span>
      </div>

      <div className="paper-card p-6">
        <p className="font-serif text-2xl leading-relaxed whitespace-pre-line">{q.question_text}</p>
      </div>

      <div className="grid gap-2">
        {q.options.map((opt, oi) => {
          const isAnswer = oi === q.correct_index;
          const isPicked = picked === oi;
          let cls = "paper-card p-3 text-sm";
          if (isAnswer) cls += " border-[var(--green)] bg-[var(--green)]/10";
          else if (isPicked) cls += " border-[var(--red)] bg-[var(--red)]/10";
          return (
            <div key={`opt-${oi}`} className={cls}>
              <span className="font-mono mr-2 text-[var(--muted)]">{String.fromCharCode(65 + oi)}.</span>
              {opt}
              {isAnswer && (
                <span className="ml-2 text-[10px] uppercase font-mono text-[var(--green)]">correct</span>
              )}
              {isPicked && !isAnswer && (
                <span className="ml-2 text-[10px] uppercase font-mono text-[var(--red)]">your pick</span>
              )}
            </div>
          );
        })}
      </div>

      {session.reasoning_text && (
        <div className="paper-card p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Your reasoning ({session.reasoning_input_method ?? "typed"})
          </p>
          <p className="mt-2 leading-relaxed font-serif text-lg whitespace-pre-line">
            {session.reasoning_text}
          </p>
        </div>
      )}

      <div className="paper-card p-6 space-y-4 border-l-4 border-l-[var(--gold)]">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-mono text-[10px] uppercase text-[var(--muted)] tracking-widest">Logic Accuracy</p>
            <p className="font-serif text-4xl">{session.reasoning_score ?? 0}/10</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase text-[var(--muted)] tracking-widest">Diagnosis</p>
            <p className="font-serif text-xl text-[var(--red)]">{session.error_type || "—"}</p>
          </div>
        </div>
        <div className="space-y-2 border-t border-[var(--border)] pt-4">
          {session.ai_diagnosis && <p className="leading-relaxed">{session.ai_diagnosis}</p>}
          {session.ai_correction && (
            <p className="text-[var(--muted)] leading-relaxed italic border-l-2 border-[var(--border)] pl-4">
              {session.ai_correction}
            </p>
          )}
        </div>
        {session.ai_pattern_alert && (
          <div className="rounded bg-[var(--blue)]/5 p-3 text-[var(--blue)] text-sm font-mono flex gap-2 items-start">
            <span>✦</span>
            <span>{session.ai_pattern_alert}</span>
          </div>
        )}
        {q.explanation && (
          <details className="rounded bg-[var(--paper2)] p-3">
            <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
              Reveal worked solution
            </summary>
            <p className="mt-2 leading-relaxed text-sm whitespace-pre-line">{q.explanation}</p>
          </details>
        )}
        <div className="flex justify-between items-center pt-2 border-t border-[var(--border)] text-[var(--muted)] text-[10px] font-mono uppercase tracking-widest">
          <span>Time taken: {session.time_taken_seconds ?? 0}s</span>
          {session.ai_next_topic && <span>Next focus: {session.ai_next_topic}</span>}
          <Link href={`/practice/${q.id}`} className="text-[var(--gold)] hover:underline">
            Re-attempt →
          </Link>
        </div>
      </div>

      <TutorThread sessionId={session.id} />
    </div>
  );
}
