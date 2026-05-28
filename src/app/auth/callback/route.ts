import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";

  if (code) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);

    // Best-effort profile bootstrap so OAuth users get a profile row immediately.
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      await db.from("profiles").upsert({
        id: user.id,
        name: user.user_metadata?.name || user.email,
      });
      await db.from("cognitive_profiles").upsert({ user_id: user.id });
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
