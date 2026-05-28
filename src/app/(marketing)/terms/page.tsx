export const metadata = {
  title: "Terms of Service — Learning Loop",
  description: "Terms of service for Learning Loop.",
};

export default function TermsPage() {
  return (
    <article className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="font-serif text-5xl">Terms of Service</h1>
      <p className="text-[var(--muted)] mt-2 font-mono text-xs">
        Last updated: {new Date().getFullYear()}-01
      </p>

      <div className="mt-8 space-y-5 leading-relaxed text-sm">
        <Section title="1. Acceptance">
          By creating an account on Learning Loop (&ldquo;the Service&rdquo;), you agree to these Terms.
          If you do not agree, please do not use the Service.
        </Section>
        <Section title="2. Eligibility">
          You must be at least 13 years old (or the minimum age required by your country)
          to use the Service. If you are under 18, your parent or guardian must agree to
          these Terms on your behalf.
        </Section>
        <Section title="3. Account">
          You are responsible for maintaining the confidentiality of your login credentials
          and for all activity under your account. Notify us immediately at
          hello@learningloop.in of any unauthorised use.
        </Section>
        <Section title="4. Subscription & billing">
          Paid plans are billed via Razorpay. Subscriptions auto-renew unless cancelled.
          You may cancel at any time; cancellation takes effect at the end of the current
          billing period. See our Refund Policy for details.
        </Section>
        <Section title="5. Acceptable use">
          You agree not to: (a) reverse-engineer or scrape the Service; (b) share your
          account credentials; (c) upload abusive, illegal, or copyrighted content; (d)
          attempt to disrupt the Service.
        </Section>
        <Section title="6. Content">
          Practice questions, diagnoses, and analytics are provided &ldquo;as is&rdquo; for
          self-study. We make no guarantee that use of the Service will produce any
          specific exam outcome.
        </Section>
        <Section title="7. Intellectual property">
          All content on the Service — questions, software, design, and AI outputs — is
          owned by Learning Loop or its licensors. You retain ownership of the reasoning
          text you submit; you grant us a non-exclusive licence to process it for the
          purpose of providing the Service.
        </Section>
        <Section title="8. Termination">
          We may suspend or terminate your account for violations of these Terms. You may
          delete your account at any time by emailing hello@learningloop.in.
        </Section>
        <Section title="9. Limitation of liability">
          To the maximum extent permitted by law, Learning Loop is not liable for indirect,
          incidental, or consequential damages arising from use of the Service.
        </Section>
        <Section title="10. Governing law">
          These Terms are governed by the laws of India. Disputes will be resolved in the
          courts of Bengaluru.
        </Section>
        <Section title="11. Changes">
          We may update these Terms. Material changes will be announced at least 14 days
          in advance via email or in-app notice.
        </Section>
        <Section title="12. Contact">
          Questions about these Terms — email hello@learningloop.in.
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
