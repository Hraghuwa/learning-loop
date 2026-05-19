"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSpeechReasoning } from "@/hooks/use-speech-reasoning";
import { toWordCount } from "@/lib/utils";

type AnalyzeResponse = {
  errorType: string;
  diagnosis: string;
  correction: string;
  reasoningScore: number;
  patternAlert: string | null;
  nextPracticeTopic: string;
};

type Props = {
  question: {
    id: string;
    topic: string;
    subtopic: string;
    difficulty: string;
    question_text: string;
    options: string[];
    correct_index: number;
    hint: string | null;
    explanation: string | null;
  };
};

type Stage =
  | "SELECTING_ANSWER"
  | "REASONING_INPUT"
  | "SUBMITTED_AWAITING_AI"
  | "ANALYSIS_SHOWN";

export function QuestionSession({ question }: Props) {
  const [stage, setStage] = useState<Stage>("SELECTING_ANSWER");
  const [selected, setSelected] = useState<number | null>(null);
  const [reasoning, setReasoning] = useState("");
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [startedAt] = useState(Date.now());
  const [method, setMethod] = useState<"typed" | "voice">("typed");

  const words = useMemo(() => toWordCount(reasoning), [reasoning]);
  const tooShort = words < 15;
  const canSubmit = selected !== null && reasoning.trim().length > 0 && !tooShort;

  const speech = useSpeechReasoning((text) => {
    setMethod("voice");
    setReasoning((prev) => `${prev} ${text}`.trim());
  });

  const [aiHint, setAiHint] = useState<string | null>(null);
  const [requestingHint, setRequestingHint] = useState(false);

  const getAiHint = async () => {
    setRequestingHint(true);
    const res = await fetch("/api/coach/hint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionText: question.question_text,
        topic: question.topic,
        subtopic: question.subtopic,
        currentReasoning: reasoning,
      }),
    });
    const data = await res.json();
    setAiHint(data.hint);
    setRequestingHint(false);
  };

  const onSubmit = async () => {
    if (!canSubmit || selected === null) return;
    setStage("SUBMITTED_AWAITING_AI");
    const payload = {
      questionId: question.id,
      questionText: question.question_text,
      topic: question.topic,
      subtopic: question.subtopic,
      options: question.options,
      correctIndex: question.correct_index,
      selectedIndex: selected,
      reasoning,
    };
    const analysisRes = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const analysisJson = await analysisRes.json();
    await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_id: question.id,
        selected_option: selected,
        is_correct: selected === question.correct_index,
        reasoning_text: reasoning,
        reasoning_input_method: method,
        error_type: analysisJson.errorType,
        reasoning_score: analysisJson.reasoningScore,
        ai_diagnosis: analysisJson.diagnosis,
        ai_correction: analysisJson.correction,
        ai_pattern_alert: analysisJson.patternAlert,
        ai_next_topic: analysisJson.nextPracticeTopic,
        time_taken_seconds: Math.floor((Date.now() - startedAt) / 1000),
      }),
    });
    setAnalysis(analysisJson);
    setStage("ANALYSIS_SHOWN");
  };

  return (
    <div className="space-y-6">
      <div className="paper-card p-4 flex items-center gap-2 text-sm font-mono text-[var(--muted)]">
        <span className="rounded bg-[var(--blue)]/10 px-2 py-1 text-[var(--blue)]">{question.topic}</span>
        <span className="rounded bg-[var(--paper2)] px-2 py-1">{question.subtopic}</span>
        <span className="rounded bg-[var(--paper2)] px-2 py-1">{question.difficulty}</span>
      </div>
      <div className="paper-card p-6">
        <p className="font-serif text-2xl leading-relaxed">{question.question_text}</p>
      </div>
      <div className="grid gap-3">
        {question.options.map((option, idx) => (
          <button
            key={option}
            onClick={() => {
              setSelected(idx);
              setStage("REASONING_INPUT");
            }}
            className={`paper-card p-4 text-left transition-all ${selected === idx ? "border-[var(--gold)] bg-[var(--gold)]/10 shadow-sm" : "hover:border-[var(--gold)] opacity-80 hover:opacity-100"}`}
          >
            <span className="font-mono mr-2 text-[var(--muted)]">{String.fromCharCode(65 + idx)}.</span>
            {option}
          </button>
        ))}
      </div>
      <div className={`paper-card p-5 transition-colors ${speech.recording ? "border-[var(--red)] ring-2 ring-[var(--red)]/10" : ""}`}>
        <div className="flex justify-between items-center mb-4">
          <label className="font-mono text-sm">
            Your Reasoning <span className="text-[var(--red)]">*</span>
          </label>
          <button
            onClick={getAiHint}
            disabled={requestingHint || reasoning.length < 5}
            className="text-[10px] uppercase tracking-widest font-mono text-[var(--gold)] hover:underline disabled:opacity-30"
          >
            {requestingHint ? "Asking coach..." : "Request AI Nudge"}
          </button>
        </div>
        <p className="mb-2 text-xs text-[var(--muted)] italic">✦ Reasoning helps you improve 3× faster</p>
        <textarea
          value={`${reasoning}${speech.interim ? ` ${speech.interim}` : ""}`}
          onChange={(e) => {
            setMethod("typed");
            setReasoning(e.target.value);
          }}
          placeholder="I chose this because I thought..."
          className="min-h-[140px] w-full rounded border border-[var(--border)] bg-[var(--paper2)] p-4 font-serif text-lg leading-relaxed outline-none focus:border-[var(--gold)]"
        />
        {aiHint && (
          <div className="mt-4 p-4 rounded bg-[var(--gold)]/5 border border-[var(--gold)]/20 text-sm italic text-[var(--gold-dark)] animate-in fade-in slide-in-from-top-2 duration-300">
             <span className="font-mono text-[10px] uppercase not-italic block mb-1">AI Coach Nudge:</span>
             "{aiHint}"
          </div>
        )}
        <div className="flex justify-between items-center mt-3">
          <div className="flex gap-2">
            {speech.supported && (
              <button
                className={`rounded border border-[var(--border)] px-3 py-1.5 text-xs font-mono transition-colors ${speech.recording ? "bg-[var(--red)]/10 border-[var(--red)] text-[var(--red)] px-5" : "hover:bg-[var(--paper2)]"}`}
                onClick={() => (speech.recording ? speech.stop() : speech.start())}
              >
                {speech.recording ? "Recording..." : "Voice Input"}
              </button>
            )}
          </div>
          <div className="text-right">
             <p className="font-mono text-[10px] text-[var(--muted)] uppercase tracking-widest">{words} words</p>
             {tooShort && <p className="text-[10px] text-[var(--red)] mt-0.5">Min 15 words required</p>}
          </div>
        </div>
      </div>
      
      <button
        disabled={!canSubmit || stage === "SUBMITTED_AWAITING_AI"}
        onClick={onSubmit}
        className="w-full rounded bg-[var(--gold)] py-4 text-white font-serif text-xl shadow-lg hover:bg-[var(--gold-dark)] transition-all disabled:opacity-50 disabled:grayscale"
      >
        {stage === "SUBMITTED_AWAITING_AI" ? "Analysing your reasoning pattern..." : "Submit for analysis"}
      </button>
      {analysis && (
        <div className="paper-card p-6 space-y-4 border-l-4 border-l-[var(--gold)] animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="flex justify-between items-start">
             <div>
               <p className="font-mono text-[10px] uppercase text-[var(--muted)] tracking-widest">Logic Accuracy</p>
               <p className="font-serif text-4xl">{Math.max(3, analysis.reasoningScore)}/10</p>
             </div>
             <div className="text-right">
               <p className="font-mono text-[10px] uppercase text-[var(--muted)] tracking-widest">Error Diagnosis</p>
               <p className="font-serif text-xl text-[var(--red)]">{analysis.errorType}</p>
             </div>
           </div>
          <div className="space-y-2 border-t border-[var(--border)] pt-4">
            <p className="leading-relaxed">{analysis.diagnosis}</p>
            <p className="text-[var(--muted)] leading-relaxed italic border-l-2 border-[var(--border)] pl-4">{analysis.correction}</p>
          </div>
          {analysis.patternAlert && (
            <div className="rounded bg-[var(--blue)]/5 p-3 text-[var(--blue)] text-sm font-mono flex gap-2 items-start">
              <span>✦</span>
              <span>{analysis.patternAlert}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-[var(--border)] text-[var(--muted)] text-[10px] font-mono uppercase tracking-widest">
            <span>Next focus: {analysis.nextPracticeTopic}</span>
            <Link href="/practice" className="text-[var(--gold)] hover:underline">Continue Loop</Link>
          </div>
        </div>
      )}
    </div>
  );
}
