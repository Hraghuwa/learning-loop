"use client";

import { useEffect, useState } from "react";

type RetrievedItem = {
  problem: string;
  answer: string;
  subDomain: string;
  score: number;
};

type PredictAllResponse = {
  classify: {
    tabular_subDomain: string | null;
    multimodal_subDomain: string | null;
    latency_ms: Record<string, number | string>;
  };
  retrieve: {
    items: RetrievedItem[];
    latency_ms: number;
  };
  generate: {
    answer: string;
    latency_ms: number;
  };
};

type HealthResponse = {
  ok: boolean;
  loaded?: string[];
  available?: Record<string, boolean>;
  error?: string;
};

const EXAMPLES = [
  "A train covers 360 km in 4 hours. What is its speed in km/h?",
  "If 8 workers build a wall in 10 days, how many days will 16 workers take?",
  "Find the simple interest on Rs 1000 at 10% per annum for 3 years.",
  "Pointing to a photograph, a man says, 'She is the daughter of my mother'. Who is she?",
  "Find the next number in the series: 2, 6, 12, 20, 30, ?",
];

export default function MLPlaygroundPage() {
  const [problem, setProblem] = useState(EXAMPLES[0]);
  const [topK, setTopK] = useState(3);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PredictAllResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    fetch("/api/ml/predict")
      .then((r) => r.json())
      .then(setHealth)
      .catch((e) =>
        setHealth({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      );
  }, []);

  async function runPrediction() {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/ml/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem, topK, mode: "predict-all" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || `HTTP ${res.status}`);
        return;
      }
      setData(json as PredictAllResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">ML Playground</h1>
        <p className="mt-2 text-sm text-gray-500">
          Compare predictions from 4 trained models — Tabular, MultiModal,
          Sentence-Transformer Retriever, and FLAN-T5 — on any CAT-style question.
        </p>
        <HealthPill health={health} />
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <label className="text-sm font-medium text-gray-700">Question</label>
        <textarea
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          rows={3}
          className="mt-2 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          placeholder="Enter a CAT-style problem..."
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-700">Top-K:</label>
            <input
              type="number"
              min={1}
              max={10}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
          <button
            onClick={runPrediction}
            disabled={loading || problem.trim().length < 3}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {loading ? "Running 4 models..." : "Predict with all models"}
          </button>

          <div className="ml-auto flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => setProblem(ex)}
                className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
              >
                Example {i + 1}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {data && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <ResultCard
            title="🌲 AutoGluon Tabular"
            subtitle="LightGBM / XGBoost ensemble · subDomain classifier"
          >
            <KV k="Predicted subDomain" v={data.classify.tabular_subDomain ?? "—"} />
            <KV
              k="Latency"
              v={`${data.classify.latency_ms.tabular ?? "—"} ms`}
            />
          </ResultCard>

          <ResultCard
            title="🤖 AutoGluon MultiModal"
            subtitle="Electra transformer · subDomain classifier"
          >
            <KV
              k="Predicted subDomain"
              v={data.classify.multimodal_subDomain ?? "(not trained yet)"}
            />
            <KV
              k="Latency"
              v={
                data.classify.latency_ms.multimodal !== undefined
                  ? `${data.classify.latency_ms.multimodal} ms`
                  : "—"
              }
            />
          </ResultCard>

          <ResultCard
            title="🔎 Sentence-Transformer Retriever"
            subtitle={`MiniLM + FAISS · Top-${topK} similar Q&A from 10K`}
          >
            <p className="text-xs text-gray-500">
              Latency: {data.retrieve.latency_ms} ms
            </p>
            <ul className="mt-2 space-y-2">
              {data.retrieve.items.map((it, i) => (
                <li
                  key={i}
                  className="rounded-md border border-gray-100 bg-gray-50 p-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-gray-500">
                      sim {it.score.toFixed(3)}
                    </span>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                      {it.subDomain}
                    </span>
                  </div>
                  <p className="mt-1 text-gray-800">
                    {it.problem.length > 160
                      ? `${it.problem.slice(0, 160)}…`
                      : it.problem}
                  </p>
                  <p className="mt-1 font-medium text-emerald-700">
                    → {it.answer}
                  </p>
                </li>
              ))}
            </ul>
          </ResultCard>

          <ResultCard
            title="🧠 FLAN-T5-small (fine-tuned)"
            subtitle="80M params · trained on 1.8K problem→answer pairs"
          >
            <KV k="Generated answer" v={data.generate.answer} />
            <KV k="Latency" v={`${data.generate.latency_ms} ms`} />
          </ResultCard>
        </div>
      )}
    </div>
  );
}

function ResultCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="text-xs text-gray-500">{subtitle}</p>
      <div className="mt-3 space-y-1.5 text-sm">{children}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-gray-500">{k}</span>
      <span className="font-medium text-gray-900">{v}</span>
    </div>
  );
}

function HealthPill({ health }: { health: HealthResponse | null }) {
  if (!health) {
    return (
      <span className="mt-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
        Checking backend…
      </span>
    );
  }
  const ok = health.ok;
  const loaded = health.loaded ?? [];
  const available = Object.entries(health.available ?? {})
    .filter(([, v]) => v)
    .map(([k]) => k);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
      <span
        className={`rounded-full px-2 py-0.5 font-medium ${
          ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
        }`}
      >
        Backend: {ok ? "online" : "offline"}
      </span>
      {available.map((m) => (
        <span
          key={m}
          className={`rounded-full px-2 py-0.5 ${
            loaded.includes(m)
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {m} {loaded.includes(m) ? "✓" : "(lazy)"}
        </span>
      ))}
      {!ok && health.error && (
        <span className="text-red-600">{health.error}</span>
      )}
    </div>
  );
}
