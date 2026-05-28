import { NextResponse } from "next/server";
import {
  generateInsightNarrative,
  type Insight,
  type SessionDigest,
} from "@/lib/ai/claude";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const STALE_HOURS = 24;
const MIN_SESSIONS = 5;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const force = searchParams.get("force") === "1";
  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Reuse if a recent insight exists and force=0.
  if (!force) {
    const { data: latest } = await db
      .from("cognitive_insights")
      .select("payload, generated_at, sessions_analyzed")
      .eq("user_id", user.id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest?.payload) {
      const ageHours =
        (Date.now() - new Date(latest.generated_at).getTime()) / (1000 * 60 * 60);
      if (ageHours < STALE_HOURS) {
        return NextResponse.json({
          insight: latest.payload as Insight,
          generatedAt: latest.generated_at,
          sessionsAnalyzed: latest.sessions_analyzed,
          cached: true,
        });
      }
    }
  }

  // Pull data needed for synthesis.
  const [{ data: profile }, { data: cog }, { data: sessions }] = await Promise.all([
    db.from("profiles").select("name").eq("id", user.id).single(),
    db.from("cognitive_profiles").select("*").eq("user_id", user.id).single(),
    db
      .from("sessions")
      .select(
        "is_correct, reasoning_score, error_type, ai_diagnosis, ai_pattern_alert, reasoning_text, created_at, questions(topic, subtopic, difficulty)",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const sessionRows = (sessions ?? []) as Array<{
    is_correct: boolean;
    reasoning_score: number | null;
    error_type: string | null;
    ai_diagnosis: string | null;
    ai_pattern_alert: string | null;
    reasoning_text: string | null;
    created_at: string;
    questions: { topic: string; subtopic: string; difficulty: string } | null;
  }>;

  if (sessionRows.length < MIN_SESSIONS) {
    return NextResponse.json({
      insight: {
        headline: "Building your cognitive baseline",
        summary: `You're at ${sessionRows.length} attempts. We need ${MIN_SESSIONS - sessionRows.length} more before patterns become visible. Keep going — every reasoning capture trains the model.`,
        recurringPatterns: [],
        strengths: [],
        trajectory: "early",
        trajectoryReason: "Insufficient data.",
        projectedPercentile: Number(cog?.percentile_estimate ?? 60),
        topRecommendations: [
          {
            action: `Solve ${MIN_SESSIONS - sessionRows.length} more questions across all three sections, with reasoning enabled.`,
            why: "Cross-section coverage is required before stable patterns emerge.",
            estimatedDays: 3,
          },
        ],
      } satisfies Insight,
      cached: false,
      sessionsAnalyzed: sessionRows.length,
    });
  }

  const digests: SessionDigest[] = sessionRows.map((s) => ({
    topic: s.questions?.topic ?? "—",
    subtopic: s.questions?.subtopic ?? "—",
    difficulty: s.questions?.difficulty ?? "—",
    isCorrect: !!s.is_correct,
    reasoningScore: Number(s.reasoning_score ?? 0),
    errorType: s.error_type,
    diagnosis: s.ai_diagnosis,
    patternAlert: s.ai_pattern_alert,
    reasoningSnippet: s.reasoning_text?.slice(0, 200) ?? null,
    createdAt: s.created_at,
  }));

  let insight: Insight;
  try {
    insight = await generateInsightNarrative({
      studentName: profile?.name ?? "Student",
      cognitiveProfile: {
        quant: Number(cog?.quant_score ?? 5),
        varc: Number(cog?.varc_score ?? 5),
        dilr: Number(cog?.dilr_score ?? 5),
        reasoning: Number(cog?.reasoning_score ?? 5),
        speed: Number(cog?.speed_score ?? 5),
        accuracy: Number(cog?.accuracy_score ?? 5),
        percentile: Number(cog?.percentile_estimate ?? 60),
        totalSessions: Number(cog?.total_sessions ?? sessionRows.length),
      },
      recentSessions: digests,
    });
  } catch (e) {
    console.error("insight generation failed", e);
    return NextResponse.json({ error: "Insight generation failed" }, { status: 500 });
  }

  await db.from("cognitive_insights").insert({
    user_id: user.id,
    payload: insight,
    sessions_analyzed: sessionRows.length,
  });

  return NextResponse.json({
    insight,
    cached: false,
    sessionsAnalyzed: sessionRows.length,
  });
}
