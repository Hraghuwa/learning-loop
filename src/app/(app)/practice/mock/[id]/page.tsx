import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MockTestRunner } from "@/components/practice/mock-test-runner";

type Question = {
  id: string;
  topic: string;
  subtopic: string;
  difficulty: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
};

export default async function MockTestPage({
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
  const { data: test } = await db
    .from("mock_tests")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!test) notFound();

  const { data: rawQ } = await db
    .from("questions")
    .select("id, topic, subtopic, difficulty, question_text, options, correct_index, explanation")
    .in("id", test.question_ids);

  const questionMap = new Map<string, Question>(
    ((rawQ ?? []) as Question[]).map((q) => [q.id, q]),
  );
  const orderedQuestions: Question[] = (test.question_ids as string[])
    .map((id: string) => questionMap.get(id))
    .filter((q: Question | undefined): q is Question => Boolean(q));

  return (
    <MockTestRunner
      testId={test.id}
      durationSeconds={test.duration_seconds}
      startedAt={test.started_at}
      status={test.status}
      score={test.score}
      questions={orderedQuestions}
      savedAnswers={(test.answers as Array<{ questionId: string; selectedIndex: number }>) || []}
    />
  );
}
