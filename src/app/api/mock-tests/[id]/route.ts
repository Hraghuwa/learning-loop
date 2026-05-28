import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const submitSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      selectedIndex: z.number().int().min(-1).max(3),
    }),
  ),
  status: z.enum(["completed", "abandoned"]).default("completed"),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data: test } = await db
    .from("mock_tests")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!test) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: questions } = await db
    .from("questions")
    .select("id, topic, subtopic, difficulty, question_text, options, correct_index, explanation")
    .in("id", test.question_ids);

  return NextResponse.json({ test, questions: questions ?? [] });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = submitSchema.parse(await req.json());

  const { id } = await params;
  const { data: test } = await db
    .from("mock_tests")
    .select("question_ids, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!test) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (test.status !== "in_progress") {
    return NextResponse.json({ error: "Already finalized" }, { status: 400 });
  }

  const { data: questions } = await db
    .from("questions")
    .select("id, correct_index")
    .in("id", test.question_ids);
  const answerKey = new Map<string, number>(
    ((questions ?? []) as Array<{ id: string; correct_index: number }>).map((q) => [q.id, q.correct_index]),
  );

  let correct = 0;
  for (const a of body.answers) {
    if (a.selectedIndex >= 0 && answerKey.get(a.questionId) === a.selectedIndex) correct++;
  }
  const score = correct;

  await db
    .from("mock_tests")
    .update({
      answers: body.answers,
      status: body.status,
      completed_at: new Date().toISOString(),
      score,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  return NextResponse.json({ score, total: test.question_ids.length });
}
