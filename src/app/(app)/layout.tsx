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

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, streak_count, xp")
    .eq("id", user.id)
    .single();
  const profileRow = profile as { name?: string; streak_count?: number; xp?: number } | null;

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <Sidebar
        userName={profileRow?.name || user.email || "Learner"}
        streak={profileRow?.streak_count ?? 0}
        xp={profileRow?.xp ?? 0}
      />
      <main className="ml-[220px] min-h-screen p-8">{children}</main>
    </div>
  );
}
