import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const createSchema = z.object({
  size: z.number().int().min(5).max(30).default(10),
  topic: z.enum(["Quantitative", "VARC", "DILR", "Mixed"]).default("Mixed"),
  durationSeconds: z.number().int().min(300).max(7200).default(1800),
});

export async function GET() {
  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await db
    .from("mock_tests")
    .select("id, status, started_at, completed_at, score, duration_seconds, question_ids")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(20);
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = createSchema.parse(await req.json());

  let q = db.from("questions").select("id");
  if (body.topic !== "Mixed") q = q.eq("topic", body.topic);
  const { data: pool } = await q.limit(200);
  const ids = ((pool ?? []) as Array<{ id: string }>).map((r) => r.id);
  if (ids.length === 0) {
    return NextResponse.json({ error: "No questions available" }, { status: 400 });
  }
  // Random sample of size N.
  const shuffled = ids.sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, Math.min(body.size, ids.length));

  const { data: created, error } = await db
    .from("mock_tests")
    .insert({
      user_id: user.id,
      question_ids: picked,
      duration_seconds: body.durationSeconds,
      status: "in_progress",
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ id: created.id });
}
