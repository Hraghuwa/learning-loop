import { notFound } from "next/navigation";
import { QuestionSession } from "@/components/practice/question-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function PracticeQuestionPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createServerSupabaseClient();
  const { data: question } = await supabase
    .from("questions")
    .select("*")
    .eq("id", params.id)
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
  return <QuestionSession question={row} />;
}
