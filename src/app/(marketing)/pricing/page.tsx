import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CheckoutButton } from "@/components/billing/checkout-button";

const plans = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    cadence: "forever",
    points: [
      "5 AI diagnoses per day",
      "Full reasoning capture",
      "Cognitive fingerprint radar",
      "Spaced-repetition review queue",
      "Mock tests (limited)",
    ],
    cta: "Start free",
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹499",
    cadence: "/ month",
    nudge: "Annual saves ₹2,000",
    highlight: true,
    points: [
      "Unlimited AI diagnoses",
      "Multi-turn tutor (Sonnet-class)",
      "4-week personalised study plan",
      "Cross-session weekly insights",
      "Voice reasoning input",
      "Full mock-test access",
      "Priority support",
    ],
    cta: "Upgrade to Pro",
    amountPaise: 49900,
  },
  {
    id: "institute",
    name: "Institute",
    price: "₹8,000",
    cadence: "/ month",
    points: [
      "All Pro features",
      "Class dashboards & analytics",
      "AI teaching recommendations",
      "Bulk student onboarding",
      "CSV export & API",
      "Dedicated success manager",
    ],
    cta: "Talk to us",
    amountPaise: 800000,
  },
];

export default async function PricingPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  let currentPlan: string | null = null;
  if (user) {
    const { data } = await db.from("profiles").select("plan").eq("id", user.id).single();
    currentPlan = (data?.plan as string) ?? "free";
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="text-center max-w-2xl mx-auto">
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--muted)] mb-3">
          Pricing
        </p>
        <h1 className="font-serif text-5xl">Simple, honest pricing</h1>
        <p className="mt-4 text-[var(--muted)]">
          Pay only when you&rsquo;re sure the loop works for you. Cancel anytime.
        </p>
      </div>

      <div className="mt-12 grid md:grid-cols-3 gap-4">
        {plans.map((p) => {
          const isCurrent = currentPlan === p.id;
          return (
            <div
              key={p.id}
              className={`paper-card p-6 flex flex-col ${
                p.highlight ? "border-[var(--gold)] border-2 shadow-lg" : ""
              }`}
            >
              {p.highlight && (
                <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--gold)] mb-2">
                  Most popular
                </p>
              )}
              <p className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
                {p.name}
              </p>
              <div className="mt-2 flex items-baseline gap-1">
                <p className="font-serif text-5xl">{p.price}</p>
                <p className="font-mono text-xs text-[var(--muted)]">{p.cadence}</p>
              </div>
              {p.nudge && (
                <p className="text-sm text-[var(--gold)] mt-1 font-mono">{p.nudge}</p>
              )}
              <ul className="mt-5 space-y-2 text-sm flex-1">
                {p.points.map((pt) => (
                  <li key={pt} className="flex gap-2">
                    <span className="text-[var(--green)]">✓</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {isCurrent ? (
                  <button
                    disabled
                    className="w-full rounded border border-[var(--border)] py-3 font-mono text-sm bg-[var(--paper2)] text-[var(--muted)]"
                  >
                    Current plan
                  </button>
                ) : p.id === "free" ? (
                  <a
                    href={user ? "/dashboard" : "/signup"}
                    className="block text-center rounded border border-[var(--border)] py-3 font-mono text-sm hover:border-[var(--gold)]"
                  >
                    {user ? "Continue free" : "Start free"}
                  </a>
                ) : p.id === "institute" ? (
                  <a
                    href="mailto:hello@learningloop.in?subject=Institute%20plan"
                    className="btn btn-primary w-full"
                  >
                    Talk to us
                  </a>
                ) : (
                  <CheckoutButton
                    plan={p.id}
                    amountPaise={p.amountPaise!}
                    label={p.cta}
                    isLoggedIn={!!user}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 max-w-2xl mx-auto text-center text-sm text-[var(--muted)]">
        <p>
          Indian customers: payments processed via Razorpay. International support and
          USD pricing are coming soon — email us if you&rsquo;re interested.
        </p>
      </div>
    </div>
  );
}
