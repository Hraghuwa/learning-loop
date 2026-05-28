import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: profile } = await db
    .from("profiles")
    .select("name, target_percentile, target_exam")
    .eq("id", user.id)
    .single();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
          Welcome to Learning Loop
        </p>
        <h1 className="font-serif text-4xl mt-1">Set up your loop in 30 seconds</h1>
        <p className="text-[var(--muted)] mt-2">
          Tell us your target. We&rsquo;ll calibrate the recommendation engine and the cognitive
          synthesis to match.
        </p>
      </div>
      <OnboardingForm
        initialName={profile?.name ?? user.user_metadata?.name ?? ""}
        initialTarget={Number(profile?.target_percentile ?? 95)}
        initialExam={profile?.target_exam ?? "CAT"}
      />
    </div>
  );
}
