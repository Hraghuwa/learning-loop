import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeReasoning, type Diagnosis } from "@/lib/ai/claude";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const FREE_DAILY_ANALYSES = 5;

const schema = z.object({
  questionId: z.string(),
  questionText: z.string(),
  topic: z.string(),
  subtopic: z.string(),
  options: z.array(z.string()).length(4),
  correctIndex: z.number().int().min(0).max(3),
  selectedIndex: z.number().int().min(0).max(3),
  reasoning: z.string(),
});

const fallback: Diagnosis = {
  errorType: "Assumption Error",
  diagnosis:
    "You attempted a valid path but the logic chain needs one more verification step.",
  correction:
    "Re-read the constraints, eliminate impossible options, and validate the final choice with a quick sanity check before locking it in.",
  reasoningScore: 5,
  patternAlert: "Tendency to lock in an answer before constraint validation.",
  nextPracticeTopic: "Constraint-based elimination",
  confidence: 0.3,
  cognitiveMoves: [],
};

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const body = schema.parse(await req.json());

    const { data: profileRow } = await db
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();
    const plan = (profileRow?.plan ?? "free") as string;

    if (plan === "free") {
      const today = new Date().toISOString().split("T")[0];
      const { data: usageRow } = await db
        .from("daily_usage")
        .select("analyses_count")
        .eq("user_id", user.id)
        .eq("usage_date", today)
        .single();
      const used = Number(usageRow?.analyses_count ?? 0);
      if (used >= FREE_DAILY_ANALYSES) {
        return NextResponse.json(
          {
            limited: true,
            message: `Free plan limit reached (${FREE_DAILY_ANALYSES} analyses/day). Upgrade to Pro for unlimited diagnostics.`,
            ...fallback,
          },
          { status: 200 },
        );
      }
    }

    const cacheKey = crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex");
    const { data: cached } = await db
      .from("analysis_cache")
      .select("response_json")
      .eq("cache_key", cacheKey)
      .single();
    const cachedRow = cached as { response_json?: Diagnosis } | null;

    let parsed: Diagnosis;
    if (cachedRow?.response_json) {
      parsed = cachedRow.response_json;
    } else {
      // Enrich with the canonical explanation so the local engine gets concept context.
      const { data: qRow } = await db
        .from("questions")
        .select("explanation")
        .eq("id", body.questionId)
        .single();
      try {
        parsed = await analyzeReasoning({ ...body, explanation: qRow?.explanation ?? null });
      } catch (e) {
        console.error("analyzeReasoning failed", e);
        parsed = { ...fallback };
      }
      await db.from("analysis_cache").upsert({ cache_key: cacheKey, response_json: parsed });
    }

    if (plan === "free") {
      await db.rpc("increment_daily_analyses", { uid: user.id });
    }

    return NextResponse.json(parsed);
  } catch (e) {
    console.error("analyze error", e);
    return NextResponse.json(fallback);
  }
}
