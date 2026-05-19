import { NextResponse } from "next/server";
import { z } from "zod";
import { generateHint } from "@/lib/ai/claude";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  questionText: z.string().min(1),
  topic: z.string(),
  subtopic: z.string(),
  currentReasoning: z.string().min(5),
});

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = schema.parse(await req.json());
    const hint = await generateHint(body);
    return NextResponse.json({ hint });
  } catch {
    return NextResponse.json({
      hint: "Re-read the question and identify which constraint you haven't used yet.",
    });
  }
}
