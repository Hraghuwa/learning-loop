"use client";

import { useEffect, useRef, useState } from "react";

type Citation = {
  text: string;
  answer: string;
  subDomain: string;
  kind: string;
  source: string;
  license: string;
  url: string;
  score: number;
};

type TutorResponse = {
  answer: string;
  method: "exact-match" | "retrieval+model" | "model-only";
  confidence: number;
  subDomain: string | null;
  citations: Citation[];
  model_answer: string;
  latency_ms: Record<string, number | string>;
};

type Turn = {
  question: string;
  response?: TutorResponse;
  error?: string;
  pending: boolean;
};

type Health = {
  ok: boolean;
  available?: Record<string, boolean>;
  error?: string;
};

const EXAMPLES = [
  "A train covers 360 km in 4 hours. What is its speed in km/h?",
  "A car travels 150 km in 2.5 hours. Find its average speed.",
  "If 8 workers build a wall in 10 days, how many days will 16 workers take?",
  "What is the LCM of 4, 6 and 8?",
  "Find the simple interest on Rs 1000 at 10% per annum for 3 years.",
];

const METHOD_LABEL: Record<TutorResponse["method"], string> = {
  "exact-match": "Exact match from corpus",
  "retrieval+model": "Retrieval + model",
  "model-only": "Model only",
};

const METHOD_COLOR: Record<TutorResponse["method"], string> = {
  "exact-match": "bg-emerald-100 text-emerald-700",
  "retrieval+model": "bg-blue-100 text-blue-700",
  "model-only": "bg-amber-100 text-amber-700",
};

export default function TutorPage() {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/ml/predict")
      .then((r) => r.json())
      .then(setHealth)
      .catch((e) =>
        setHealth({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      );
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  async function ask(question: string) {
    const q = question.trim();
    if (q.length < 3) return;
    setInput("");
    const idx = turns.length;
    setTurns((t) => [...t, { question: q, pending: true }]);

    try {
      const res = await fetch("/api/ml/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem: q, topK: 4, mode: "tutor" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setTurns((t) =>
          t.map((turn, i) =>
            i === idx ? { ...turn, pending: false, error: json.error || `HTTP ${res.status}` } : turn,
          ),
        );
        return;
      }
      setTurns((t) =>
        t.map((turn, i) =>
          i === idx ? { ...turn, pending: false, response: json as TutorResponse } : turn,
        ),
      );
    } catch (e) {
      setTurns((t) =>
        t.map((turn, i) =>
          i === idx
            ? { ...turn, pending: false, error: e instanceof Error ? e.message : String(e) }
            : turn,
        ),
      );
    }
  }

  return (
    <div className="mx-auto flex h-screen max-w-3xl flex-col px-4 py-6">
      <header className="mb-4 shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">AI Tutor</h1>
        <p className="text-sm text-gray-500">
          Ask any quant / reasoning question. Answers are grounded in a
          licensed corpus and shown with their sources.
        </p>
        <HealthPill health={health} />
      </header>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50/50 p-4"
      >
        {turns.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-gray-400">
            <p className="mb-3">Ask a question to get started, or try an example:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => ask(ex)}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:border-blue-400 hover:text-blue-600"
                >
                  {ex.length > 42 ? `${ex.slice(0, 42)}…` : ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, i) => (
          <div key={i} className="space-y-2">
            {/* Question bubble */}
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2 text-sm text-white">
                {turn.question}
              </div>
            </div>

            {/* Answer bubble */}
            <div className="flex justify-start">
              <div className="w-full max-w-[95%] rounded-2xl rounded-bl-sm border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm">
                {turn.pending && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
                    Thinking… (retrieving + generating)
                  </div>
                )}
                {turn.error && (
                  <div className="text-red-600">
                    <strong>Error:</strong> {turn.error}
                    <p className="mt-1 text-xs text-gray-500">
                      Is the ML backend running on :8000?
                    </p>
                  </div>
                )}
                {turn.response && <AnswerCard r={turn.response} />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="mt-4 flex shrink-0 gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a quant or reasoning question…"
          className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <button
          type="submit"
          disabled={input.trim().length < 3}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Ask
        </button>
      </form>
    </div>
  );
}

function AnswerCard({ r }: { r: TutorResponse }) {
  const [showSources, setShowSources] = useState(false);
  const pct = Math.round(r.confidence * 100);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${METHOD_COLOR[r.method]}`}>
          {METHOD_LABEL[r.method]}
        </span>
        {r.subDomain && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
            {r.subDomain}
          </span>
        )}
        <span className="ml-auto text-[11px] text-gray-400">{pct}% confidence</span>
      </div>

      {/* confidence bar */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${
            pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : "bg-amber-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="text-base font-semibold text-gray-900">{r.answer}</div>

      {r.method !== "exact-match" && r.model_answer && r.model_answer !== r.answer && (
        <p className="text-xs text-gray-500">
          Model raw output: <span className="font-mono">{r.model_answer}</span>
        </p>
      )}

      {r.citations.length > 0 && (
        <div>
          <button
            onClick={() => setShowSources((s) => !s)}
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            {showSources ? "Hide" : "Show"} {r.citations.length} source
            {r.citations.length > 1 ? "s" : ""}
          </button>
          {showSources && (
            <ul className="mt-2 space-y-1.5">
              {r.citations.map((c, i) => (
                <li key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-gray-400">sim {c.score.toFixed(3)}</span>
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">
                      {c.subDomain}
                    </span>
                  </div>
                  <p className="mt-1 text-gray-700">
                    {c.text.length > 200 ? `${c.text.slice(0, 200)}…` : c.text}
                  </p>
                  {c.answer && (
                    <p className="mt-1 font-medium text-emerald-700">→ {c.answer}</p>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-400">
                    <span>{c.source}</span>
                    <span className="rounded bg-gray-200 px-1 py-0.5">{c.license}</span>
                    {c.url && (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        link
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function HealthPill({ health }: { health: Health | null }) {
  if (!health) {
    return (
      <span className="mt-1 inline-block text-xs text-gray-400">Checking backend…</span>
    );
  }
  const ok = health.ok;
  const prod = health.available?.prod_retriever;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
      <span
        className={`rounded-full px-2 py-0.5 font-medium ${
          ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
        }`}
      >
        Backend {ok ? "online" : "offline"}
      </span>
      {ok && (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
          corpus: {prod ? "full (~550K)" : "demo (10.5K)"}
        </span>
      )}
      {!ok && health.error && <span className="text-red-600">{health.error}</span>}
    </div>
  );
}
