import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { join_code } = await req.json();
  if (!join_code) return NextResponse.json({ error: "Missing join code" }, { status: 400 });

  // 1. Find the class by code
  const { data: classData, error: classError } = await supabase
    .from("institute_classes")
    .select("id")
    .eq("join_code", join_code.toUpperCase())
    .single();

  if (classError || !classData) {
    return NextResponse.json({ error: "Invalid join code" }, { status: 404 });
  }

  // 2. Enroll the student
  const { error: enrollError } = await supabase
    .from("class_enrollments")
    .upsert([{ class_id: classData.id, student_id: user.id }], { onConflict: "class_id, student_id" });

  if (enrollError) {
    return NextResponse.json({ error: enrollError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, class_id: classData.id });
}
