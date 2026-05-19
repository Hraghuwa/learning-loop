import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ema, mapToPercentile } from "@/lib/scoring/cognitive-profile";
import { nextSchedule } from "@/lib/scoring/spaced-repetition";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const insertPayload = { ...body, user_id: user.id };
  const { data: insertedRow, error } = await db
    .from("sessions")
    .insert(insertPayload)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // 1. Cognitive profile EMA update.
  const { data: cpRow } = await db
    .from("cognitive_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();
  const old = cpRow ?? {
    quant_score: 5,
    varc_score: 5,
    dilr_score: 5,
    reasoning_score: 5,
    speed_score: 5,
    accuracy_score: 5,
    total_sessions: 0,
  };
  const { data: qRow } = await db
    .from("questions")
    .select("topic, subtopic")
    .eq("id", body.question_id)
    .single();
  const topic: string = qRow?.topic ?? "Quantitative";
  const subtopic: string = qRow?.subtopic ?? "";
  const topicKey =
    topic === "Quantitative" ? "quant_score" : topic === "VARC" ? "varc_score" : "dilr_score";
  const reasoningScore = Number(body.reasoning_score ?? 5);
  const accuracyPoint = body.is_correct ? 10 : 3;
  const speedPoint = Math.max(
    1,
    10 - Math.floor(Number(body.time_taken_seconds ?? 60) / 30),
  );
  const nextProfile = {
    user_id: user.id,
    quant_score: old.quant_score,
    varc_score: old.varc_score,
    dilr_score: old.dilr_score,
    [topicKey]: ema(Number(old[topicKey]) || 5, accuracyPoint),
    reasoning_score: ema(Number(old.reasoning_score) || 5, reasoningScore),
    accuracy_score: ema(Number(old.accuracy_score) || 5, accuracyPoint),
    speed_score: ema(Number(old.speed_score) || 5, speedPoint),
    total_sessions: Number(old.total_sessions ?? 0) + 1,
    top_error_pattern: body.error_type ?? old.top_error_pattern ?? null,
  };
  const aggregateScore =
    (nextProfile.reasoning_score + nextProfile.accuracy_score + nextProfile.speed_score) / 3;
  await db.from("cognitive_profiles").upsert({
    ...nextProfile,
    percentile_estimate: mapToPercentile(aggregateScore),
    updated_at: new Date().toISOString(),
  });

  // 2. Subtopic mastery EMA.
  if (subtopic) {
    const { data: mRow } = await db
      .from("subtopic_mastery")
      .select("mastery, attempts, correct")
      .eq("user_id", user.id)
      .eq("topic", topic)
      .eq("subtopic", subtopic)
      .single();
    const oldM = mRow ?? { mastery: 5, attempts: 0, correct: 0 };
    const masteryPoint = body.is_correct ? Math.min(10, reasoningScore + 1) : Math.max(2, reasoningScore - 2);
    await db.from("subtopic_mastery").upsert({
      user_id: user.id,
      topic,
      subtopic,
      mastery: ema(Number(oldM.mastery) || 5, masteryPoint),
      attempts: Number(oldM.attempts ?? 0) + 1,
      correct: Number(oldM.correct ?? 0) + (body.is_correct ? 1 : 0),
      updated_at: new Date().toISOString(),
    });
  }

  // 3. Review queue (spaced repetition).
  const { data: rqRow } = await db
    .from("review_queue")
    .select("interval_days, ease, attempts")
    .eq("user_id", user.id)
    .eq("question_id", body.question_id)
    .single();
  const oldRq = rqRow ?? { interval_days: 0, ease: 2.5, attempts: 0 };
  const outcome: "correct" | "wrong" = body.is_correct ? "correct" : "wrong";
  const sched = nextSchedule({
    prevIntervalDays: Number(oldRq.interval_days) || 0,
    prevEase: Number(oldRq.ease) || 2.5,
    outcome,
    reasoningScore,
  });
  await db.from("review_queue").upsert(
    {
      user_id: user.id,
      question_id: body.question_id,
      due_at: sched.dueAt,
      interval_days: sched.intervalDays,
      ease: sched.ease,
      attempts: Number(oldRq.attempts ?? 0) + 1,
      last_outcome: outcome,
    },
    { onConflict: "user_id,question_id" },
  );

  // 4. Streak + XP on profile.
  const today = new Date().toISOString().split("T")[0];
  const { data: pRow } = await db
    .from("profiles")
    .select("streak_count, last_active_date, xp")
    .eq("id", user.id)
    .single();
  const profile = pRow ?? { streak_count: 0, last_active_date: null, xp: 0 };
  const lastDate = profile.last_active_date as string | null;
  const isConsecutive = lastDate
    ? Math.abs(new Date(today).getTime() - new Date(lastDate).getTime()) <= 86400000
    : false;
  const hasReasoning = String(body.reasoning_text ?? "").trim().length > 0;
  const streak = !hasReasoning
    ? Number(profile.streak_count ?? 0)
    : lastDate === today
      ? Number(profile.streak_count ?? 0)
      : isConsecutive
        ? Number(profile.streak_count ?? 0) + 1
        : 1;
  const xpGain = 10 + (reasoningScore >= 7 ? 20 : 0) + (body.is_correct ? 5 : 0);
  await db.from("profiles").update({
    streak_count: streak,
    last_active_date: today,
    xp: Number(profile.xp ?? 0) + xpGain,
  }).eq("id", user.id);

  return NextResponse.json(insertedRow);
}
