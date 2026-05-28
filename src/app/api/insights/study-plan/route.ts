import { NextResponse } from "next/server";
import { z } from "zod";
import { generateStudyPlan, type Insight, type StudyPlan } from "@/lib/ai/claude";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const planSchema = z.object({
  targetPercentile: z.number().int().min(50).max(99).default(95),
  weeklyHours: z.number().int().min(2).max(40).default(7),
});

export async function GET() {
  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await db
    .from("study_plans")
    .select("id, payload, target_percentile, weekly_hours, generated_at, active")
    .eq("user_id", user.id)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json(data ?? null);
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { targetPercentile, weeklyHours } = planSchema.parse(await req.json().catch(() => ({})));

  const [{ data: profile }, { data: cog }, { data: insights }] = await Promise.all([
    db.from("profiles").select("name, target_percentile").eq("id", user.id).single(),
    db.from("cognitive_profiles").select("*").eq("user_id", user.id).single(),
    db
      .from("cognitive_insights")
      .select("payload")
      .eq("user_id", user.id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const insight: Insight | null = insights?.payload ?? null;
  const topPatterns =
    insight?.recurringPatterns?.slice(0, 5).map((p) => ({ name: p.name, severity: p.severity })) ?? [];

  let plan: StudyPlan;
  try {
    plan = await generateStudyPlan({
      studentName: profile?.name ?? "Student",
      targetPercentile,
      weeklyHours,
      cognitiveProfile: {
        quant: Number(cog?.quant_score ?? 5),
        varc: Number(cog?.varc_score ?? 5),
        dilr: Number(cog?.dilr_score ?? 5),
        reasoning: Number(cog?.reasoning_score ?? 5),
        speed: Number(cog?.speed_score ?? 5),
        accuracy: Number(cog?.accuracy_score ?? 5),
        percentile: Number(cog?.percentile_estimate ?? 60),
      },
      topPatterns,
    });
  } catch (e) {
    console.error("study plan generation failed", e);
    return NextResponse.json({ error: "Plan generation failed" }, { status: 500 });
  }

  // Deactivate any prior plans, persist new one.
  await db.from("study_plans").update({ active: false }).eq("user_id", user.id);
  const { data: created } = await db
    .from("study_plans")
    .insert({
      user_id: user.id,
      payload: plan,
      target_percentile: targetPercentile,
      weekly_hours: weeklyHours,
      active: true,
    })
    .select("id")
    .single();

  return NextResponse.json({ id: created?.id, plan });
}
