export const metadata = {
  title: "Refund Policy — Learning Loop",
  description: "Our refund and cancellation policy.",
};

export default function RefundPage() {
  return (
    <article className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="font-serif text-5xl">Refund Policy</h1>
      <p className="text-[var(--muted)] mt-2 font-mono text-xs">
        Last updated: {new Date().getFullYear()}-01
      </p>

      <div className="mt-8 space-y-5 leading-relaxed text-sm">
        <Section title="7-day refund window">
          If you upgrade to a paid plan and decide it is not for you, email
          hello@learningloop.in within 7 days of purchase for a full refund. No
          questions asked.
        </Section>
        <Section title="Cancellation">
          You may cancel your subscription at any time from Settings or by emailing us.
          Cancellation stops the next renewal; you retain access until the end of the
          current billing period.
        </Section>
        <Section title="Partial refunds">
          Outside the 7-day window we do not offer pro-rata refunds for the unused portion
          of the current billing period.
        </Section>
        <Section title="Annual plans">
          For annual plans, refunds within 14 days of purchase are honoured pro-rata
          minus a one-month usage fee.
        </Section>
        <Section title="Contact">
          All refund requests — hello@learningloop.in. Mention the email associated with
          your account and the order ID from your Razorpay receipt.
        </Section>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-serif text-xl mb-1">{title}</h2>
      <p>{children}</p>
    </div>
  );
}
