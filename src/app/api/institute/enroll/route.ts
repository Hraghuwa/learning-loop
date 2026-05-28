import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { join_code } = await req.json();
  if (!join_code) return NextResponse.json({ error: "Missing join code" }, { status: 400 });

  const { data: classData, error: classError } = await db
    .from("institute_classes")
    .select("id")
    .eq("join_code", String(join_code).toUpperCase())
    .single();

  if (classError || !classData) {
    return NextResponse.json({ error: "Invalid join code" }, { status: 404 });
  }

  const { error: enrollError } = await db
    .from("class_enrollments")
    .upsert([{ class_id: classData.id, student_id: user.id }], {
      onConflict: "class_id, student_id",
    });

  if (enrollError) {
    return NextResponse.json({ error: enrollError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, class_id: classData.id });
}
