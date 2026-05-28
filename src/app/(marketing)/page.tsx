import Link from "next/link";

export default function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--muted)] mb-4">
          Reasoning-first CAT prep
        </p>
        <h1 className="font-serif text-5xl sm:text-6xl leading-[1.05]">
          Most apps grade your answers.
          <br />
          <span className="text-[var(--gold)]">We diagnose how you think.</span>
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-lg text-[var(--muted)] leading-relaxed">
          Capture your reasoning before you submit. Get a surgical cognitive diagnosis on
          every attempt. Build a fingerprint of your thinking — and the exact path to lift it.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/signup"
            className="rounded bg-[var(--gold)] text-white px-6 py-3 font-mono text-sm hover:bg-[var(--gold-dark)]"
          >
            Start free →
          </Link>
          <Link
            href="/pricing"
            className="rounded border border-[var(--border)] px-6 py-3 font-mono text-sm hover:border-[var(--gold)]"
          >
            See pricing
          </Link>
        </div>
        <p className="mt-4 font-mono text-[10px] text-[var(--muted)]">
          No credit card required · 5 AI diagnoses per day on the free plan
        </p>
      </section>

      {/* Differentiator strip */}
      <section className="bg-[var(--paper2)] border-y border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-6 py-12 grid md:grid-cols-3 gap-8">
          <Pillar
            n="01"
            title="Mandatory reasoning capture"
            body="You can't submit without explaining why. Voice input supported. The reasoning is the practice."
          />
          <Pillar
            n="02"
            title="Surgical AI diagnosis"
            body="A fine-tuned cognitive engine names the specific thinking move that helped or hurt you — not a generic 'review the topic'."
          />
          <Pillar
            n="03"
            title="A fingerprint, not a score"
            body="Six-axis radar, recurring habit detection, projected percentile, and a personalised 4-week plan that adapts to your patterns."
          />
        </div>
      </section>

      {/* The loop */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">The loop</p>
        <h2 className="font-serif text-4xl mt-1">Four moves, repeated until it clicks</h2>
        <div className="mt-10 grid md:grid-cols-4 gap-4">
          <Step n="1" t="Pick" b="Choose any question or accept the recommendation tuned to your weakest area." />
          <Step n="2" t="Reason" b="Write or speak your thinking. Minimum 15 words, no shortcuts." />
          <Step n="3" t="Submit" b="Get an instant cognitive diagnosis: error type, reasoning score, pattern alert, next focus." />
          <Step n="4" t="Loop" b="Wrong attempts return on a spaced-repetition schedule. Patterns surface. The model learns you." />
        </div>
      </section>

      {/* Features */}
      <section className="bg-[var(--paper2)] border-y border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-6">
          <Feature
            title="Cognitive Fingerprint"
            body="Six-axis radar across Quant, VARC, DILR, Reasoning, Speed, and Accuracy. Updated after every attempt via EMA."
          />
          <Feature
            title="Adaptive practice"
            body="The next-question engine pulls from your weakest subtopics first, then your spaced-repetition queue, then exploration."
          />
          <Feature
            title="Mock tests, exam-mode"
            body="Timed 10/15/20 question sets across topics. Auto-graded with full explanations. Build test-day rhythm."
          />
          <Feature
            title="Multi-turn tutor"
            body="Ask anything about an attempt. The tutor knows your diagnosis and walks you through the chain Socratically."
          />
          <Feature
            title="4-week study plan"
            body="A personalised plan generated from your profile and recurring patterns. Daily drills, success signals, guardrails."
          />
          <Feature
            title="Self-sufficient by default"
            body="Runs on a deterministic local engine — no API keys required. Plug in Ollama or Anthropic if you want LLM-grade prose."
          />
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="font-serif text-4xl">
          The students who explain their reasoning improve <em>3× faster.</em>
        </h2>
        <p className="mt-4 text-[var(--muted)]">
          Bring your discipline. We&rsquo;ll bring the diagnosis.
        </p>
        <Link
          href="/signup"
          className="mt-8 inline-block rounded bg-[var(--gold)] text-white px-6 py-3 font-mono text-sm"
        >
          Start free →
        </Link>
      </section>
    </div>
  );
}

function Pillar({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] text-[var(--gold)] uppercase tracking-widest">{n}</p>
      <p className="font-serif text-2xl mt-2">{title}</p>
      <p className="text-[var(--muted)] text-sm mt-2 leading-relaxed">{body}</p>
    </div>
  );
}

function Step({ n, t, b }: { n: string; t: string; b: string }) {
  return (
    <div className="paper-card p-4">
      <p className="font-mono text-[10px] text-[var(--gold)] uppercase tracking-widest">Step {n}</p>
      <p className="font-serif text-2xl mt-1">{t}</p>
      <p className="text-sm text-[var(--muted)] mt-2 leading-relaxed">{b}</p>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="paper-card p-5">
      <p className="font-serif text-xl">{title}</p>
      <p className="text-sm text-[var(--muted)] mt-2 leading-relaxed">{body}</p>
    </div>
  );
}
