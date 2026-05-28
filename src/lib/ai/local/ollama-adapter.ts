/**
 * Optional Ollama adapter — for users who want a local open-weights LLM
 * driving diagnoses (e.g., Llama 3.1 8B, Qwen 2.5, Phi-3).
 *
 * Activation: set env vars
 *   LEARNING_LOOP_AI_PROVIDER=ollama
 *   OLLAMA_URL=http://localhost:11434  (default)
 *   OLLAMA_MODEL=llama3.1:8b           (default)
 *
 * If the host is unreachable, callers should fall back to the rule-based engine.
 */

import type { Diagnosis } from "../claude-types";

const DEFAULT_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "llama3.1:8b";

const SYSTEM = `You are a CAT exam cognitive diagnostician. Output STRICT JSON only — no markdown, no preamble. Schema:
{"errorType":"Conceptual Gap|Calculation Error|Misread Question|Shortcut Missed|Assumption Error|No Reasoning Provided|Correct Reasoning","diagnosis":"2-3 sentences","correction":"3-4 sentences","reasoningScore":0,"patternAlert":"one sentence or null","nextPracticeTopic":"specific","confidence":0.7,"cognitiveMoves":["..."]}`;

export async function ollamaDiagnose(payload: {
  questionText: string;
  topic: string;
  subtopic: string;
  options: string[];
  correctIndex: number;
  selectedIndex: number;
  reasoning: string;
}): Promise<Diagnosis | null> {
  const letters = ["A", "B", "C", "D"];
  const isCorrect = payload.correctIndex === payload.selectedIndex;
  const prompt = `${SYSTEM}

TOPIC: ${payload.topic}/${payload.subtopic}
QUESTION: ${payload.questionText}
A) ${payload.options[0]}
B) ${payload.options[1]}
C) ${payload.options[2]}
D) ${payload.options[3]}
CORRECT: ${letters[payload.correctIndex]}
STUDENT CHOSE: ${letters[payload.selectedIndex]} (${isCorrect ? "right" : "wrong"})
REASONING: """${payload.reasoning}"""

Return JSON now.`;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 45_000);
    const res = await fetch(`${DEFAULT_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        prompt,
        stream: false,
        format: "json",
        options: { temperature: 0.2 },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const json = (await res.json()) as { response?: string };
    if (!json.response) return null;
    const parsed = JSON.parse(json.response) as Partial<Diagnosis>;
    return {
      errorType: (parsed.errorType as Diagnosis["errorType"]) ?? "Assumption Error",
      diagnosis: String(parsed.diagnosis ?? ""),
      correction: String(parsed.correction ?? ""),
      reasoningScore: clampInt(Number(parsed.reasoningScore ?? 5), 0, 10),
      patternAlert:
        typeof parsed.patternAlert === "string" && parsed.patternAlert.trim()
          ? parsed.patternAlert
          : null,
      nextPracticeTopic: String(parsed.nextPracticeTopic ?? ""),
      confidence: clamp(Number(parsed.confidence ?? 0.5), 0, 1),
      cognitiveMoves: Array.isArray(parsed.cognitiveMoves)
        ? parsed.cognitiveMoves.filter((s) => typeof s === "string").slice(0, 8)
        : [],
    };
  } catch {
    return null;
  }
}

export async function ollamaText(prompt: string, system?: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 45_000);
    const composed = system ? `${system}\n\n${prompt}` : prompt;
    const res = await fetch(`${DEFAULT_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        prompt: composed,
        stream: false,
        options: { temperature: 0.4 },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const json = (await res.json()) as { response?: string };
    return json.response?.trim() ?? null;
  } catch {
    return null;
  }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, isFinite(n) ? n : lo));
}
function clampInt(n: number, lo: number, hi: number) {
  return Math.round(clamp(n, lo, hi));
}
