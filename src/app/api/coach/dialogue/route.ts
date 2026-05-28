import { NextResponse } from "next/server";
import { z } from "zod";
import { tutorReply, type Diagnosis, type TutorTurn } from "@/lib/ai/claude";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  sessionId: z.string(),
  message: z.string().min(1).max(2000),
});

type Question = {
  id: string;
  topic: string;
  subtopic: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
};

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = schema.parse(await req.json());

  const { data: sess } = await db
    .from("sessions")
    .select(
      "id, error_type, reasoning_score, ai_diagnosis, ai_correction, ai_pattern_alert, ai_next_topic, questions(id, topic, subtopic, question_text, options, correct_index, explanation)",
    )
    .eq("id", body.sessionId)
    .eq("user_id", user.id)
    .single();
  const session = sess as
    | {
        id: string;
        error_type: string | null;
        reasoning_score: number | null;
        ai_diagnosis: string | null;
        ai_correction: string | null;
        ai_pattern_alert: string | null;
        ai_next_topic: string | null;
        questions: Question | null;
      }
    | null;
  if (!session?.questions) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { data: threadRow } = await db
    .from("tutor_threads")
    .select("id, messages")
    .eq("user_id", user.id)
    .eq("session_id", body.sessionId)
    .maybeSingle();
  const history: TutorTurn[] = (threadRow?.messages as TutorTurn[]) ?? [];
  history.push({ role: "user", content: body.message });

  const diagnosis: Diagnosis | null = session.ai_diagnosis
    ? {
        errorType: (session.error_type as Diagnosis["errorType"]) ?? "Assumption Error",
        diagnosis: session.ai_diagnosis ?? "",
        correction: session.ai_correction ?? "",
        reasoningScore: Number(session.reasoning_score ?? 5),
        patternAlert: session.ai_pattern_alert,
        nextPracticeTopic: session.ai_next_topic ?? "",
        confidence: 0.8,
        cognitiveMoves: [],
      }
    : null;

  let reply = "Tell me where you got stuck.";
  try {
    reply = await tutorReply({
      questionContext: {
        topic: session.questions.topic,
        subtopic: session.questions.subtopic,
        questionText: session.questions.question_text,
        options: session.questions.options,
        correctIndex: session.questions.correct_index,
        explanation: session.questions.explanation,
      },
      diagnosis,
      history,
    });
  } catch (e) {
    console.error("tutor reply failed", e);
  }
  history.push({ role: "assistant", content: reply });

  if (threadRow?.id) {
    await db
      .from("tutor_threads")
      .update({ messages: history, updated_at: new Date().toISOString() })
      .eq("id", threadRow.id);
  } else {
    await db.from("tutor_threads").insert({
      user_id: user.id,
      session_id: body.sessionId,
      question_id: session.questions.id,
      messages: history,
    });
  }

  return NextResponse.json({ reply, history });
}

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ messages: [] });

  const { data } = await db
    .from("tutor_threads")
    .select("messages")
    .eq("user_id", user.id)
    .eq("session_id", sessionId)
    .maybeSingle();
  return NextResponse.json({ messages: (data?.messages as TutorTurn[]) ?? [] });
}
