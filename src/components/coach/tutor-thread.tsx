"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; content: string };

type Props = {
  sessionId: string;
};

const STARTERS = [
  "Walk me through the correct sequence step by step.",
  "Where exactly did my reasoning break?",
  "Give me one cleaner way to attack this kind of question.",
];

export function TutorThread({ sessionId }: Props) {
  const [messages, setMessages] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || loaded) return;
    void (async () => {
      try {
        const res = await fetch(`/api/coach/dialogue?sessionId=${sessionId}`);
        const data = await res.json();
        setMessages((data.messages as Turn[]) ?? []);
      } finally {
        setLoaded(true);
      }
    })();
  }, [open, loaded, sessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    const optimistic: Turn = { role: "user", content: text };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    try {
      const res = await fetch("/api/coach/dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tutor unavailable");
      if (Array.isArray(data.history)) setMessages(data.history as Turn[]);
      else if (data.reply) setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tutor failed.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(draft);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="paper-card p-4 w-full text-left hover:border-[var(--gold)] flex items-center justify-between"
      >
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Multi-turn tutor
          </p>
          <p className="font-serif text-lg mt-1">Ask Sonnet 4.6 about this attempt</p>
        </div>
        <span className="text-[var(--gold)] font-mono text-xs">Open chat →</span>
      </button>
    );
  }

  return (
    <div className="paper-card p-4 space-y-3 border-l-4 border-l-[var(--gold)]">
      <div className="flex justify-between items-baseline">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Tutor · Sonnet 4.6
          </p>
          <p className="font-serif text-lg">Ask anything about this attempt</p>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-xs font-mono text-[var(--muted)] hover:text-[var(--ink)]"
        >
          Close
        </button>
      </div>

      <div
        ref={scrollRef}
        className="max-h-96 overflow-y-auto space-y-3 rounded bg-[var(--paper2)] p-3 text-sm"
      >
        {messages.length === 0 && !busy && (
          <div className="space-y-2">
            <p className="text-[var(--muted)] italic">Pick a starter or write your own.</p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded border border-[var(--border)] px-2 py-1 text-xs hover:border-[var(--gold)]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded p-3 leading-relaxed whitespace-pre-line ${
                m.role === "user"
                  ? "bg-[var(--gold)]/15 text-[var(--ink)]"
                  : "bg-[var(--paper)] border border-[var(--border)]"
              }`}
            >
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-1">
                {m.role === "user" ? "You" : "Tutor"}
              </p>
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded p-3 bg-[var(--paper)] border border-[var(--border)] text-[var(--muted)] italic">
              Tutor is thinking...
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-[var(--red)] font-mono">{error}</p>}

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a question for the tutor..."
          className="flex-1 rounded border border-[var(--border)] bg-[var(--paper2)] px-3 py-2 text-sm outline-none focus:border-[var(--gold)]"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="rounded bg-[var(--gold)] text-white px-4 text-sm font-mono disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
