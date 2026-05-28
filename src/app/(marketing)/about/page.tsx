export const metadata = {
  title: "About — Learning Loop",
  description: "Why we built a reasoning-first prep platform for CAT.",
};

export default function AboutPage() {
  return (
    <article className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="font-serif text-5xl">A different premise</h1>
      <p className="text-[var(--muted)] mt-2 font-mono text-xs uppercase tracking-widest">
        About Learning Loop
      </p>

      <div className="mt-8 space-y-5 leading-relaxed text-[var(--ink)]">
        <p>
          Most prep platforms grade your answers. They tell you the score, the topic, the
          rank. They do not tell you <em>how you think</em> — and that is the only piece
          that compounds.
        </p>
        <p>
          Learning Loop forces you to write or speak your reasoning before you submit.
          Then a cognitive engine — running locally, by default, with no API calls — looks
          at the chain you produced, names the specific cognitive move that helped or hurt
          you, and points to where to go next. Wrong attempts return on a spaced-repetition
          schedule. Patterns surface. The model learns you, not the other way around.
        </p>
        <p>
          We built this because the students who explain themselves — out loud, in writing,
          to a peer — improve roughly three times faster than the ones who silently grind
          questions. The science is settled; the tools were not. Now they are.
        </p>
        <p>
          The platform is self-sufficient by default: zero API keys, zero outbound network,
          everything runs in your server process. If you want LLM-grade prose, plug in a
          local Ollama install or, on Pro, route to Claude Opus 4.7 with extended thinking
          and tool-use for tighter diagnoses.
        </p>
        <p>
          We are a small team in India building for India first. Email{" "}
          <a className="text-[var(--gold)]" href="mailto:hello@learningloop.in">
            hello@learningloop.in
          </a>{" "}
          if you want to talk.
        </p>
      </div>
    </article>
  );
}
