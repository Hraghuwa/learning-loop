import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const today = new Date().toISOString().split("T")[0];

  const [{ data: profile }, { data: usage }] = await Promise.all([
    db.from("profiles").select("name, streak_count, xp, plan").eq("id", user.id).single(),
    db.from("daily_usage").select("analyses_count").eq("user_id", user.id).eq("usage_date", today).maybeSingle(),
  ]);

  const profileRow =
    (profile as { name?: string; streak_count?: number; xp?: number; plan?: string } | null) ??
    null;

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <Sidebar
        userName={profileRow?.name || user.email || "Learner"}
        streak={profileRow?.streak_count ?? 0}
        xp={profileRow?.xp ?? 0}
        plan={profileRow?.plan ?? "free"}
        todayUsage={Number(usage?.analyses_count ?? 0)}
      />
      <main className="md:ml-[220px] min-h-screen p-4 pt-20 md:pt-8 md:p-8">{children}</main>
    </div>
  );
}
