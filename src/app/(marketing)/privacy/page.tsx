export const metadata = {
  title: "Privacy Policy — Learning Loop",
  description: "How Learning Loop collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <article className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="font-serif text-5xl">Privacy Policy</h1>
      <p className="text-[var(--muted)] mt-2 font-mono text-xs">
        Last updated: {new Date().getFullYear()}-01
      </p>

      <div className="mt-8 space-y-5 leading-relaxed text-sm">
        <Section title="1. What we collect">
          <ul className="list-disc pl-5 space-y-1">
            <li>Account info: name, email, hashed password (or OAuth identifier).</li>
            <li>Practice data: questions attempted, answers, reasoning text, timestamps.</li>
            <li>Cognitive profile: derived scores per topic and reasoning axis.</li>
            <li>Usage telemetry: which pages you visit, which features you use.</li>
          </ul>
        </Section>
        <Section title="2. How we use it">
          We use your data only to operate and improve the Service: generate diagnoses,
          recommend questions, build your cognitive profile, and surface relevant insights.
          We do not sell your personal data.
        </Section>
        <Section title="3. AI processing">
          By default, your reasoning text is processed by a deterministic local engine that
          runs entirely within our servers — no third-party AI service is contacted. If you
          opt into Pro AI features, your reasoning may be processed by Anthropic
          (Claude) or your self-hosted Ollama endpoint, per your settings.
        </Section>
        <Section title="4. Storage">
          Data is stored in Supabase Postgres (region: ap-south-1) with row-level security.
          Backups are encrypted at rest.
        </Section>
        <Section title="5. Sharing">
          We share data with: (a) Supabase (hosting & auth); (b) Razorpay (payments);
          (c) PostHog (anonymised product analytics); (d) Anthropic, only if you have
          opted in. We do not share data with marketers.
        </Section>
        <Section title="6. Your rights">
          You may export, correct, or delete your data at any time by emailing
          hello@learningloop.in. We respond within 30 days.
        </Section>
        <Section title="7. Cookies">
          We use first-party cookies for authentication. We do not use third-party
          tracking cookies.
        </Section>
        <Section title="8. Security">
          Passwords are hashed; sessions are HttpOnly, SameSite=Lax. We follow industry
          best practices but cannot guarantee perfect security. Notify us of any concerns.
        </Section>
        <Section title="9. Children">
          The Service is not directed to children under 13 (or the local minimum age).
        </Section>
        <Section title="10. Contact">
          Privacy questions — email hello@learningloop.in.
        </Section>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-serif text-xl mb-1">{title}</h2>
      <div>{children}</div>
    </div>
  );
}
