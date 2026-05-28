import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/settings/settings-form";
import { LogoutButton } from "@/components/settings/logout-button";

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: profile } = await db
    .from("profiles")
    .select("name, target_percentile, target_exam, plan, streak_count, xp, created_at")
    .eq("id", user.id)
    .single();

  const today = new Date().toISOString().split("T")[0];
  const { data: usage } = await db
    .from("daily_usage")
    .select("analyses_count")
    .eq("user_id", user.id)
    .eq("usage_date", today)
    .maybeSingle();

  const planLabels: Record<string, string> = {
    free: "Free",
    pro: "Pro · ₹499/mo",
    institute: "Institute · ₹8,000/mo",
  };
  const plan = (profile?.plan ?? "free") as keyof typeof planLabels;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
          Account
        </p>
        <h1 className="font-serif text-4xl mt-1">Settings</h1>
      </div>

      <div className="paper-card p-5 grid sm:grid-cols-2 gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Email
          </p>
          <p className="mt-1">{user.email}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Member since
          </p>
          <p className="mt-1">
            {profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString()
              : "—"}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Plan
          </p>
          <p className="mt-1 font-serif text-xl">{planLabels[plan]}</p>
          {plan === "free" ? (
            <Link
              href="/pricing"
              className="text-xs font-mono text-[var(--gold)] hover:underline"
            >
              Upgrade →
            </Link>
          ) : (
            <p className="text-xs font-mono text-[var(--muted)]">
              Manage at <a href="mailto:hello@learningloop.in" className="underline">hello@learningloop.in</a>
            </p>
          )}
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Today&rsquo;s usage
          </p>
          <p className="mt-1 font-serif text-xl">
            {Number(usage?.analyses_count ?? 0)}{plan === "free" ? " / 5" : " analyses"}
          </p>
          {plan === "free" && (
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Resets at midnight (your timezone).
            </p>
          )}
        </div>
      </div>

      <div className="paper-card p-5">
        <h2 className="font-serif text-2xl mb-3">Profile</h2>
        <SettingsForm
          initialName={profile?.name ?? ""}
          initialTarget={Number(profile?.target_percentile ?? 95)}
          initialExam={profile?.target_exam ?? "CAT"}
        />
      </div>

      <div className="paper-card p-5">
        <h2 className="font-serif text-2xl mb-3">Account</h2>
        <div className="space-y-3">
          <Link
            href="/forgot-password"
            className="block rounded border border-[var(--border)] px-4 py-2.5 text-sm hover:border-[var(--gold)]"
          >
            Change password
          </Link>
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
