import Link from "next/link";
import { notFound } from "next/navigation";
import { QuestionSession } from "@/components/practice/question-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function PracticeQuestionPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const supabase = await createServerSupabaseClient();
  const { id } = await params;
  const { data: question } = await supabase
    .from("questions")
    .select("*")
    .eq("id", id)
    .single();
  const row = question as {
    id: string;
    topic: string;
    subtopic: string;
    difficulty: string;
    question_text: string;
    options: string[];
    correct_index: number;
    hint: string | null;
    explanation: string | null;
  } | null;

  if (!row) notFound();
  return (
    <div className="space-y-4">
      <Link
        href="/practice"
        className="font-mono text-xs text-[var(--muted)] hover:text-[var(--gold)]"
      >
        ← Back to practice
      </Link>
      <QuestionSession question={row} />
    </div>
  );
}
