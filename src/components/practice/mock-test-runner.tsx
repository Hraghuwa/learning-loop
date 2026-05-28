"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Question = {
  id: string;
  topic: string;
  subtopic: string;
  difficulty: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
};

type Props = {
  testId: string;
  durationSeconds: number;
  startedAt: string;
  status: string;
  score: number | null;
  questions: Question[];
  savedAnswers: Array<{ questionId: string; selectedIndex: number }>;
};

export function MockTestRunner(props: Props) {
  const router = useRouter();
  const completed = props.status !== "in_progress";

  const [answers, setAnswers] = useState<Map<string, number>>(() => {
    const m = new Map<string, number>();
    for (const a of props.savedAnswers ?? []) m.set(a.questionId, a.selectedIndex);
    return m;
  });
  const [idx, setIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const startMs = useMemo(() => new Date(props.startedAt).getTime(), [props.startedAt]);
  const endMs = startMs + props.durationSeconds * 1000;
  const [now, setNow] = useState<number>(() => Date.now());
  const submittedRef = useRef(false);

  useEffect(() => {
    if (completed) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [completed]);

  const remainingSec = Math.max(0, Math.floor((endMs - now) / 1000));
  const minutes = Math.floor(remainingSec / 60);
  const seconds = remainingSec % 60;

  const submit = async (status: "completed" | "abandoned" = "completed") => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    const payload = {
      status,
      answers: props.questions.map((q) => ({
        questionId: q.id,
        selectedIndex: answers.has(q.id) ? (answers.get(q.id) as number) : -1,
      })),
    };
    try {
      const res = await fetch(`/api/mock-tests/${props.testId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setResultMessage(`You scored ${data.score}/${data.total}.`);
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (completed) return;
    if (remainingSec === 0) {
      void submit("completed");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSec, completed]);

  if (completed) {
    const correct = props.questions.filter((q) => {
      const ans = (props.savedAnswers ?? []).find((a) => a.questionId === q.id);
      return ans && ans.selectedIndex === q.correct_index;
    }).length;
    return (
      <div className="space-y-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">Mock test</p>
          <h1 className="font-serif text-4xl mt-1">
            {props.score != null ? `${props.score}/${props.questions.length}` : `${correct}/${props.questions.length}`}
          </h1>
          <p className="text-[var(--muted)] mt-1">
            Status: {props.status === "completed" ? "Completed" : "Abandoned"}
          </p>
        </div>
        <div className="grid gap-3">
          {props.questions.map((q, i) => {
            const ans = (props.savedAnswers ?? []).find((a) => a.questionId === q.id);
            const isCorrect = ans?.selectedIndex === q.correct_index;
            return (
              <div key={q.id} className="paper-card p-4">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <p className="font-mono text-[10px] text-[var(--muted)] uppercase">
                      Q{i + 1} · {q.topic} · {q.subtopic}
                    </p>
                    <p className="font-serif text-lg leading-relaxed mt-1">{q.question_text}</p>
                  </div>
                  <span
                    className={`font-mono text-xs ${
                      ans && isCorrect
                        ? "text-[var(--green)]"
                        : ans
                          ? "text-[var(--red)]"
                          : "text-[var(--muted)]"
                    }`}
                  >
                    {ans && isCorrect ? "Correct" : ans ? "Wrong" : "Skipped"}
                  </span>
                </div>
                <div className="mt-3 grid gap-2">
                  {q.options.map((opt, oi) => {
                    const isAnswer = oi === q.correct_index;
                    const isPicked = ans?.selectedIndex === oi;
                    let cls = "rounded border p-2 text-sm";
                    if (isAnswer) cls += " border-[var(--green)] bg-[var(--green)]/10";
                    else if (isPicked) cls += " border-[var(--red)] bg-[var(--red)]/10";
                    else cls += " border-[var(--border)]";
                    return (
                      <div key={`${q.id}-opt-${oi}`} className={cls}>
                        <span className="font-mono text-[var(--muted)] mr-2">
                          {String.fromCharCode(65 + oi)}.
                        </span>
                        {opt}
                      </div>
                    );
                  })}
                </div>
                {q.explanation && (
                  <details className="mt-3 rounded bg-[var(--paper2)] p-2">
                    <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
                      Explanation
                    </summary>
                    <p className="mt-2 text-sm whitespace-pre-line">{q.explanation}</p>
                  </details>
                )}
              </div>
            );
          })}
        </div>
        <Link href="/practice/mock" className="inline-block rounded bg-[var(--gold)] px-5 py-2 text-white font-mono text-sm">
          ← All mock tests
        </Link>
      </div>
    );
  }

  const q = props.questions[idx];
  if (!q) return <p>No questions in this test.</p>;
  const picked = answers.get(q.id);
  const answeredCount = answers.size;
  const lowTime = remainingSec < 60;

  return (
    <div className="space-y-5">
      <div className="paper-card p-4 flex items-center justify-between sticky top-2 z-20">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">Mock test</p>
          <p className="font-serif text-2xl">
            Question {idx + 1} of {props.questions.length}
          </p>
        </div>
        <div className={`font-mono text-2xl ${lowTime ? "text-[var(--red)]" : ""}`}>
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </div>
      </div>

      <div className="paper-card p-4 flex flex-wrap gap-2">
        {props.questions.map((qq, i) => {
          const has = answers.has(qq.id);
          return (
            <button
              key={qq.id}
              onClick={() => setIdx(i)}
              className={`h-8 w-8 rounded text-xs font-mono ${
                i === idx
                  ? "bg-[var(--gold)] text-white"
                  : has
                    ? "bg-[var(--green)]/10 text-[var(--green)] border border-[var(--green)]/30"
                    : "bg-[var(--paper2)] text-[var(--muted)]"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="paper-card p-6">
        <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-widest mb-2">
          {q.topic} · {q.subtopic} · {q.difficulty}
        </p>
        <p className="font-serif text-2xl leading-relaxed whitespace-pre-line">{q.question_text}</p>
      </div>

      <div className="grid gap-2">
        {q.options.map((opt, oi) => (
          <button
            key={`${q.id}-${oi}`}
            onClick={() => setAnswers((m) => new Map(m).set(q.id, oi))}
            className={`paper-card p-3 text-left transition-colors ${
              picked === oi ? "border-[var(--gold)] bg-[var(--gold)]/10" : "hover:border-[var(--gold)]"
            }`}
          >
            <span className="font-mono mr-2 text-[var(--muted)]">{String.fromCharCode(65 + oi)}.</span>
            {opt}
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center gap-3">
        <button
          disabled={idx === 0}
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          className="rounded border border-[var(--border)] px-4 py-2 text-sm font-mono disabled:opacity-30"
        >
          ← Previous
        </button>
        <p className="font-mono text-xs text-[var(--muted)]">
          {answeredCount}/{props.questions.length} answered
        </p>
        {idx < props.questions.length - 1 ? (
          <button
            onClick={() => setIdx((i) => Math.min(props.questions.length - 1, i + 1))}
            className="rounded bg-[var(--gold)] px-4 py-2 text-white text-sm font-mono"
          >
            Next →
          </button>
        ) : (
          <button
            disabled={submitting}
            onClick={() => submit("completed")}
            className="rounded bg-[var(--green)] px-4 py-2 text-white text-sm font-mono disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit test"}
          </button>
        )}
      </div>

      {resultMessage && (
        <p className="font-mono text-sm text-[var(--green)]">{resultMessage}</p>
      )}
    </div>
  );
}
