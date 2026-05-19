import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Question = {
  id: string;
  topic: string;
  subtopic: string;
  difficulty: string;
  question_text: string;
};

type Mastery = { topic: string; subtopic: string; mastery: number };

type ReviewRow = {
  question_id: string;
  due_at: string;
  questions: Question | null;
};

const TOPIC_KEYS = {
  Quantitative: "quant_score",
  VARC: "varc_score",
  DILR: "dilr_score",
} as const;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(20, Number(searchParams.get("limit") ?? 10));
  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1. Pull due review items.
  const nowIso = new Date().toISOString();
  const { data: dueRaw } = await db
    .from("review_queue")
    .select("question_id, due_at, questions(id, topic, subtopic, difficulty, question_text)")
    .eq("user_id", user.id)
    .lte("due_at", nowIso)
    .order("due_at", { ascending: true })
    .limit(limit);
  const due = ((dueRaw ?? []) as ReviewRow[])
    .filter((r) => r.questions)
    .map((r) => ({ ...(r.questions as Question), reason: "due_review" as const }));

  // 2. If we still need more, recommend from weakest topics & subtopics.
  const needed = limit - due.length;
  let recommended: Array<Question & { reason: "weak_area" | "exploration" }> = [];
  if (needed > 0) {
    const { data: cogRaw } = await db
      .from("cognitive_profiles")
      .select("quant_score, varc_score, dilr_score")
      .eq("user_id", user.id)
      .single();
    const cog = cogRaw ?? { quant_score: 5, varc_score: 5, dilr_score: 5 };

    // Pick the weakest topic, with mild randomness for variety.
    const topicScores = (Object.entries(TOPIC_KEYS) as Array<[keyof typeof TOPIC_KEYS, string]>).map(
      ([topic, key]) => ({ topic, score: Number(cog[key as keyof typeof cog] ?? 5) }),
    );
    topicScores.sort((a, b) => a.score - b.score);
    const weakestTopic = topicScores[0]?.topic ?? "Quantitative";

    // Pull subtopic mastery; weakest subtopic in weakest topic gets prioritized.
    const { data: mRaw } = await db
      .from("subtopic_mastery")
      .select("topic, subtopic, mastery")
      .eq("user_id", user.id)
      .eq("topic", weakestTopic);
    const mastery = (mRaw ?? []) as Mastery[];

    // Exclude any question_ids already in the due list to avoid duplication.
    const excludeIds = new Set(due.map((q) => q.id));

    let candidates: Question[] = [];
    if (mastery.length) {
      mastery.sort((a, b) => a.mastery - b.mastery);
      const targetSubs = mastery.slice(0, 3).map((m) => m.subtopic);
      const { data: rows } = await db
        .from("questions")
        .select("id, topic, subtopic, difficulty, question_text")
        .eq("topic", weakestTopic)
        .in("subtopic", targetSubs)
        .limit(needed * 4);
      candidates = (rows ?? []) as Question[];
    }
    if (candidates.length < needed) {
      const { data: rows2 } = await db
        .from("questions")
        .select("id, topic, subtopic, difficulty, question_text")
        .eq("topic", weakestTopic)
        .limit(needed * 4);
      candidates = candidates.concat((rows2 ?? []) as Question[]);
    }
    if (candidates.length < needed) {
      const { data: rows3 } = await db
        .from("questions")
        .select("id, topic, subtopic, difficulty, question_text")
        .limit(needed * 4);
      candidates = candidates.concat((rows3 ?? []) as Question[]);
    }

    // Filter out already-mastered questions answered correctly in the last 14 days.
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

    // Deduplicate and prioritize topic match.
    const seen = new Set<string>(excludeIds);
    const filtered = candidates.filter((q) => {
      if (seen.has(q.id)) return false;
      if (recentlyCorrect.has(q.id)) return false;
      seen.add(q.id);
      return true;
    });

    recommended = filtered.slice(0, needed).map((q) => ({
      ...q,
      reason: (mastery.length ? "weak_area" : "exploration") as "weak_area" | "exploration",
    }));
  }

  return NextResponse.json({
    items: [...due, ...recommended],
    counts: { due: due.length, recommended: recommended.length },
  });
}
