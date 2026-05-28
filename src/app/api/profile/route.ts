import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await db
    .from("cognitive_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

const patchSchema = z.object({
  bootstrap: z.boolean().optional(),
  name: z.string().min(1).max(120).optional(),
  target_percentile: z.number().int().min(50).max(99).optional(),
  target_exam: z.enum(["CAT", "XAT", "CMAT", "Other"]).optional(),
});

export async function PATCH(req: Request) {
  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }
  const body = parsed.data;

  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.target_percentile !== undefined) update.target_percentile = body.target_percentile;
  if (body.target_exam !== undefined) update.target_exam = body.target_exam;

  if (body.bootstrap) {
    await db.from("profiles").upsert({
      id: user.id,
      name: update.name ?? user.user_metadata?.name ?? user.email,
      target_percentile: update.target_percentile ?? 95,
      target_exam: update.target_exam ?? "CAT",
    });
    await db.from("cognitive_profiles").upsert({ user_id: user.id });
    return NextResponse.json({ ok: true, bootstrap: true });
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, noChanges: true });
  }

  const { error } = await db.from("profiles").update(update).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
