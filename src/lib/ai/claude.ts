/**
 * Cognitive engine — provider-dispatched.
 *
 *   LEARNING_LOOP_AI_PROVIDER values:
 *     "local"  (default): zero network. Rule-based deterministic engine
 *                          in `lib/ai/local/`. Runs in-process, ~1ms/call.
 *     "ollama"          : local open-weights LLM (Llama/Qwen/Phi via Ollama).
 *                          Falls back to "local" on any error.
 *     "anthropic"       : Claude Opus 4.7 / Sonnet 4.6 / Haiku 4.5 with
 *                          extended thinking + tool-use + prompt caching.
 *                          Falls back to "local" if no API key.
 *     "hybrid"          : try anthropic, then ollama, then local.
 *
 * Public surface (unchanged across providers): analyzeReasoning, generateHint,
 * generateInsightNarrative, generateStudyPlan, tutorReply.
 */

import Anthropic from "@anthropic-ai/sdk";
import { localDiagnose } from "./local/diagnosis-engine";
import { localHint } from "./local/hint-engine";
import { localInsight } from "./local/insight-engine";
import { localStudyPlan } from "./local/plan-engine";
import { localTutorReply } from "./local/tutor-engine";
import { ollamaDiagnose, ollamaText } from "./local/ollama-adapter";
import type {
  Diagnosis,
  Insight,
  SessionDigest,
  StudyPlan,
  TutorTurn,
} from "./claude-types";

export type { Diagnosis, Insight, SessionDigest, StudyPlan, TutorTurn };

export const MODELS = {
  reasoning: "claude-opus-4-7",
  workhorse: "claude-sonnet-4-6",
  fast: "claude-haiku-4-5-20251001",
} as const;

type Provider = "local" | "ollama" | "anthropic" | "hybrid";

function provider(): Provider {
  const raw = (process.env.LEARNING_LOOP_AI_PROVIDER || "local").toLowerCase();
  if (raw === "ollama" || raw === "anthropic" || raw === "hybrid") return raw;
  return "local";
}

function anthropicAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (!anthropicAvailable()) return null;
  anthropicClient ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropicClient;
}

// ---------------------------------------------------------------------------
// 1) Per-attempt diagnosis
// ---------------------------------------------------------------------------

export type DiagnosisInput = {
  questionText: string;
  topic: string;
  subtopic: string;
  options: string[];
  correctIndex: number;
  selectedIndex: number;
  reasoning: string;
  explanation?: string | null;
};

export async function analyzeReasoning(payload: DiagnosisInput): Promise<Diagnosis> {
  const p = provider();

  if (p === "local") return localDiagnose(payload);

  if (p === "ollama") {
    const out = await ollamaDiagnose(payload);
    return out ?? localDiagnose(payload);
  }

  if (p === "anthropic" || p === "hybrid") {
    const client = getAnthropic();
    if (client) {
      try {
        return await anthropicDiagnose(client, payload);
      } catch (e) {
        console.warn("[learning-loop] Anthropic diagnose failed, falling back:", e);
      }
    }
    if (p === "hybrid") {
      const out = await ollamaDiagnose(payload);
      if (out) return out;
    }
    return localDiagnose(payload);
  }

  return localDiagnose(payload);
}

// ---------------------------------------------------------------------------
// 2) Coach hint
// ---------------------------------------------------------------------------

export async function generateHint(payload: {
  questionText: string;
  topic: string;
  subtopic: string;
  currentReasoning: string;
}): Promise<string> {
  const p = provider();
  if (p === "local") return localHint(payload);

  if (p === "ollama") {
    const out = await ollamaText(
      `Question (${payload.topic}/${payload.subtopic}): ${payload.questionText}\nStudent's current reasoning: ${payload.currentReasoning}\n\nGive a single one-sentence cognitive nudge. Do NOT reveal the answer. Under 50 words.`,
      "You are a CAT coach. Output one nudge, no preamble.",
    );
    return out ?? localHint(payload);
  }

  if (p === "anthropic" || p === "hybrid") {
    const client = getAnthropic();
    if (client) {
      try {
        return await anthropicHint(client, payload);
      } catch (e) {
        console.warn("[learning-loop] Anthropic hint failed, falling back:", e);
      }
    }
    if (p === "hybrid") {
      const out = await ollamaText(
        `Question (${payload.topic}/${payload.subtopic}): ${payload.questionText}\nStudent's reasoning: ${payload.currentReasoning}\n\nOne-sentence cognitive nudge, no answer.`,
      );
      if (out) return out;
    }
    return localHint(payload);
  }

  return localHint(payload);
}

// ---------------------------------------------------------------------------
// 3) Cross-session insight
// ---------------------------------------------------------------------------

export async function generateInsightNarrative(input: {
  studentName: string;
  cognitiveProfile: {
    quant: number;
    varc: number;
    dilr: number;
    reasoning: number;
    speed: number;
    accuracy: number;
    percentile: number;
    totalSessions: number;
  };
  recentSessions: SessionDigest[];
}): Promise<Insight> {
  const p = provider();

  if (p === "anthropic" || p === "hybrid") {
    const client = getAnthropic();
    if (client) {
      try {
        return await anthropicInsight(client, input);
      } catch (e) {
        console.warn("[learning-loop] Anthropic insight failed, falling back:", e);
      }
    }
  }

  // Ollama fallback for insight is too unreliable JSON-wise; go straight to local.
  return localInsight(input);
}

// ---------------------------------------------------------------------------
// 4) Study plan
// ---------------------------------------------------------------------------

export async function generateStudyPlan(input: {
  studentName: string;
  targetPercentile: number;
  weeklyHours: number;
  cognitiveProfile: {
    quant: number;
    varc: number;
    dilr: number;
    reasoning: number;
    speed: number;
    accuracy: number;
    percentile: number;
  };
  topPatterns: { name: string; severity: string }[];
}): Promise<StudyPlan> {
  const p = provider();
  if (p === "anthropic" || p === "hybrid") {
    const client = getAnthropic();
    if (client) {
      try {
        return await anthropicPlan(client, input);
      } catch (e) {
        console.warn("[learning-loop] Anthropic plan failed, falling back:", e);
      }
    }
  }
  return localStudyPlan(input);
}

// ---------------------------------------------------------------------------
// 5) Tutor dialogue
// ---------------------------------------------------------------------------

export async function tutorReply(input: {
  questionContext: {
    topic: string;
    subtopic: string;
    questionText: string;
    options: string[];
    correctIndex: number;
    explanation: string | null;
  };
  diagnosis: Diagnosis | null;
  history: TutorTurn[];
}): Promise<string> {
  const p = provider();

  if (p === "local") return localTutorReply(input);

  if (p === "ollama") {
    const out = await ollamaText(buildTutorPrompt(input), TUTOR_SYSTEM);
    return out ?? localTutorReply(input);
  }

  if (p === "anthropic" || p === "hybrid") {
    const client = getAnthropic();
    if (client) {
      try {
        return await anthropicTutor(client, input);
      } catch (e) {
        console.warn("[learning-loop] Anthropic tutor failed, falling back:", e);
      }
    }
    if (p === "hybrid") {
      const out = await ollamaText(buildTutorPrompt(input), TUTOR_SYSTEM);
      if (out) return out;
    }
    return localTutorReply(input);
  }

  return localTutorReply(input);
}

// ===========================================================================
//                       Anthropic-backed implementations
// ===========================================================================

const DIAGNOSIS_SYSTEM = `You are Learning Loop's Cognitive Diagnostician — an elite CAT mentor with the pattern-recognition of someone who has reviewed 100,000 student attempts.

Your job is NOT to grade right/wrong. Your job is to surface the THINKING PATTERN behind a student's answer, regardless of whether they got it correct.

Diagnostic principles
1. A correct answer with sloppy reasoning is a future failure — flag it.
2. An incorrect answer with sound reasoning is a near-miss — encourage it.
3. Generic feedback ("review the topic") is useless. Be surgical.
4. Quote phrases from the student's own reasoning when useful.
5. Always end with a forward path.
6. Tone: brilliant mentor; never harsh. Editorial precision.

Reasoning-score rubric (0–10)
- 0–2: No reasoning, pure guess, or restating the question.
- 3–4: Surface-level reasoning — named the topic but no logic chain.
- 5–6: Partial logic — missed a constraint or made an unjustified leap.
- 7–8: Sound logic with a small gap (arithmetic, edge case, terminology slip).
- 9–10: Crisp, complete reasoning — even if the final answer is wrong.

Process: think step-by-step, then submit via the submit_diagnosis tool.`;

const DIAGNOSIS_TOOL: Anthropic.Tool = {
  name: "submit_diagnosis",
  description: "Submit the structured cognitive diagnosis. Always call exactly once.",
  input_schema: {
    type: "object",
    properties: {
      errorType: {
        type: "string",
        enum: [
          "Conceptual Gap",
          "Calculation Error",
          "Misread Question",
          "Shortcut Missed",
          "Assumption Error",
          "No Reasoning Provided",
          "Correct Reasoning",
        ],
      },
      diagnosis: { type: "string" },
      correction: { type: "string" },
      reasoningScore: { type: "integer", minimum: 0, maximum: 10 },
      patternAlert: { type: ["string", "null"] },
      nextPracticeTopic: { type: "string" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      cognitiveMoves: { type: "array", items: { type: "string" } },
    },
    required: [
      "errorType",
      "diagnosis",
      "correction",
      "reasoningScore",
      "patternAlert",
      "nextPracticeTopic",
      "confidence",
      "cognitiveMoves",
    ],
  },
};

async function anthropicDiagnose(client: Anthropic, payload: DiagnosisInput): Promise<Diagnosis> {
  const letters = ["A", "B", "C", "D"];
  const isCorrect = payload.correctIndex === payload.selectedIndex;
  const userPrompt = `TOPIC: ${payload.topic} / ${payload.subtopic}
QUESTION:
${payload.questionText}

OPTIONS:
  A) ${payload.options[0]}
  B) ${payload.options[1]}
  C) ${payload.options[2]}
  D) ${payload.options[3]}

CORRECT ANSWER: ${letters[payload.correctIndex]}) ${payload.options[payload.correctIndex]}
STUDENT CHOSE:  ${letters[payload.selectedIndex]}) ${payload.options[payload.selectedIndex]}
RESULT: ${isCorrect ? "CORRECT" : "INCORRECT"}

STUDENT'S REASONING (verbatim):
"""
${payload.reasoning}
"""

Diagnose the cognitive pattern. Reason step-by-step, then call submit_diagnosis exactly once.`;

  const response = await client.messages.create({
    model: MODELS.reasoning,
    max_tokens: 4096,
    thinking: { type: "enabled", budget_tokens: 3000 },
    system: [{ type: "text", text: DIAGNOSIS_SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [DIAGNOSIS_TOOL],
    tool_choice: { type: "tool", name: "submit_diagnosis" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "submit_diagnosis",
  );
  if (!toolUse) throw new Error("submit_diagnosis tool was not called");
  return normalizeDiagnosis(toolUse.input as Partial<Diagnosis> | undefined, payload);
}

function normalizeDiagnosis(
  input: Partial<Diagnosis> | undefined,
  payload: DiagnosisInput,
): Diagnosis {
  if (!input) return localDiagnose(payload);
  return {
    errorType: (input.errorType as Diagnosis["errorType"]) || "Assumption Error",
    diagnosis: typeof input.diagnosis === "string" ? input.diagnosis : "",
    correction: typeof input.correction === "string" ? input.correction : "",
    reasoningScore: clampInt(Number(input.reasoningScore ?? 5), 0, 10),
    patternAlert:
      typeof input.patternAlert === "string" && input.patternAlert.trim()
        ? input.patternAlert
        : null,
    nextPracticeTopic:
      typeof input.nextPracticeTopic === "string" ? input.nextPracticeTopic : "",
    confidence: clamp(Number(input.confidence ?? 0.7), 0, 1),
    cognitiveMoves: Array.isArray(input.cognitiveMoves)
      ? input.cognitiveMoves.filter((s) => typeof s === "string").slice(0, 8)
      : [],
  };
}

// ---- hint ------------------------------------------------------------------

const HINT_SYSTEM = `You are Learning Loop's CAT coach. Provide a single "Cognitive Nudge" — a hint that redirects the student's attention without revealing the answer.

Rules
- Never state the correct option or compute the final value.
- Identify ONE constraint, definition, or step they appear to be skipping.
- Phrase as a question or pointer, not a solution.
- Under 50 words. No preamble.`;

async function anthropicHint(
  client: Anthropic,
  payload: { questionText: string; topic: string; subtopic: string; currentReasoning: string },
): Promise<string> {
  const user = `TOPIC: ${payload.topic} / ${payload.subtopic}
QUESTION: ${payload.questionText}
STUDENT'S CURRENT REASONING:
"""
${payload.currentReasoning}
"""

Give the nudge.`;

  const message = await client.messages.create({
    model: MODELS.fast,
    max_tokens: 200,
    system: [{ type: "text", text: HINT_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  });
  const block = message.content.find((b) => b.type === "text");
  return block?.type === "text" ? block.text.trim() : "";
}

// ---- insight ---------------------------------------------------------------

const INSIGHT_SYSTEM = `You are Learning Loop's senior diagnostician. Review the student's recent attempts and produce a synthesis a great human tutor would give after a 1-hour 1:1 review. Anchor every claim in evidence. Then call submit_insight exactly once.`;

const INSIGHT_TOOL: Anthropic.Tool = {
  name: "submit_insight",
  description: "Submit the cross-session synthesis.",
  input_schema: {
    type: "object",
    properties: {
      headline: { type: "string" },
      summary: { type: "string" },
      recurringPatterns: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            evidence: { type: "string" },
            severity: { type: "string", enum: ["low", "medium", "high"] },
          },
          required: ["name", "evidence", "severity"],
        },
      },
      strengths: { type: "array", items: { type: "string" }, maxItems: 4 },
      trajectory: { type: "string", enum: ["rising", "plateau", "regressing", "early"] },
      trajectoryReason: { type: "string" },
      projectedPercentile: { type: "number", minimum: 1, maximum: 99.9 },
      topRecommendations: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            action: { type: "string" },
            why: { type: "string" },
            estimatedDays: { type: "integer", minimum: 1, maximum: 30 },
          },
          required: ["action", "why", "estimatedDays"],
        },
      },
    },
    required: [
      "headline",
      "summary",
      "recurringPatterns",
      "strengths",
      "trajectory",
      "trajectoryReason",
      "projectedPercentile",
      "topRecommendations",
    ],
  },
};

async function anthropicInsight(
  client: Anthropic,
  input: {
    studentName: string;
    cognitiveProfile: {
      quant: number;
      varc: number;
      dilr: number;
      reasoning: number;
      speed: number;
      accuracy: number;
      percentile: number;
      totalSessions: number;
    };
    recentSessions: SessionDigest[];
  },
): Promise<Insight> {
  const sessionsBlock = input.recentSessions
    .slice(0, 30)
    .map(
      (s, i) =>
        `[${i + 1}] ${s.topic}/${s.subtopic} (${s.difficulty}) — ${s.isCorrect ? "✓" : "✗"} | reasoning ${s.reasoningScore}/10 | ${s.errorType ?? "—"}\n   diagnosis: ${s.diagnosis ?? "—"}\n   pattern:   ${s.patternAlert ?? "—"}`,
    )
    .join("\n\n");

  const userPrompt = `STUDENT: ${input.studentName}
COGNITIVE PROFILE
  Quant ${input.cognitiveProfile.quant.toFixed(1)} · VARC ${input.cognitiveProfile.varc.toFixed(1)} · DILR ${input.cognitiveProfile.dilr.toFixed(1)}
  Reasoning ${input.cognitiveProfile.reasoning.toFixed(1)} · Speed ${input.cognitiveProfile.speed.toFixed(1)} · Accuracy ${input.cognitiveProfile.accuracy.toFixed(1)}
  Current percentile: ${input.cognitiveProfile.percentile.toFixed(0)}
  Total sessions: ${input.cognitiveProfile.totalSessions}

RECENT ATTEMPTS:
${sessionsBlock || "(none)"}

Synthesize, then call submit_insight.`;

  const response = await client.messages.create({
    model: MODELS.reasoning,
    max_tokens: 6000,
    thinking: { type: "enabled", budget_tokens: 4000 },
    system: [{ type: "text", text: INSIGHT_SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [INSIGHT_TOOL],
    tool_choice: { type: "tool", name: "submit_insight" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "submit_insight",
  );
  if (!toolUse) return localInsight(input);
  return (toolUse.input as Insight) ?? localInsight(input);
}

// ---- plan ------------------------------------------------------------------

const PLAN_SYSTEM = `You are Learning Loop's strategist. Build a 4-week plan grounded in the student's profile and recurring patterns. Then call submit_plan exactly once.`;

const PLAN_TOOL: Anthropic.Tool = {
  name: "submit_plan",
  description: "Submit the 4-week study plan.",
  input_schema: {
    type: "object",
    properties: {
      goal: { type: "string" },
      weeklyHours: { type: "number" },
      weeks: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            weekNumber: { type: "integer", minimum: 1, maximum: 4 },
            focus: { type: "string" },
            rationale: { type: "string" },
            dailyDrills: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  day: { type: "string" },
                  task: { type: "string" },
                  minutes: { type: "integer" },
                },
                required: ["day", "task", "minutes"],
              },
            },
            successSignal: { type: "string" },
          },
          required: ["weekNumber", "focus", "rationale", "dailyDrills", "successSignal"],
        },
      },
      guardrails: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
    },
    required: ["goal", "weeklyHours", "weeks", "guardrails"],
  },
};

async function anthropicPlan(
  client: Anthropic,
  input: {
    studentName: string;
    targetPercentile: number;
    weeklyHours: number;
    cognitiveProfile: {
      quant: number;
      varc: number;
      dilr: number;
      reasoning: number;
      speed: number;
      accuracy: number;
      percentile: number;
    };
    topPatterns: { name: string; severity: string }[];
  },
): Promise<StudyPlan> {
  const userPrompt = `STUDENT: ${input.studentName}
TARGET: ${input.targetPercentile}th percentile, ${input.weeklyHours}h/week.
PROFILE: Q${input.cognitiveProfile.quant.toFixed(1)} V${input.cognitiveProfile.varc.toFixed(1)} D${input.cognitiveProfile.dilr.toFixed(1)} R${input.cognitiveProfile.reasoning.toFixed(1)} S${input.cognitiveProfile.speed.toFixed(1)} A${input.cognitiveProfile.accuracy.toFixed(1)} ~${input.cognitiveProfile.percentile.toFixed(0)}%ile
PATTERNS: ${input.topPatterns.map((p) => `${p.name} (${p.severity})`).join(", ") || "(none)"}
Build the 4-week plan, then call submit_plan.`;

  const response = await client.messages.create({
    model: MODELS.reasoning,
    max_tokens: 6000,
    thinking: { type: "enabled", budget_tokens: 3000 },
    system: [{ type: "text", text: PLAN_SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [PLAN_TOOL],
    tool_choice: { type: "tool", name: "submit_plan" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "submit_plan",
  );
  if (!toolUse) return localStudyPlan(input);
  return (toolUse.input as StudyPlan) ?? localStudyPlan(input);
}

// ---- tutor -----------------------------------------------------------------

const TUTOR_SYSTEM = `You are Learning Loop's tutor. Talk to a CAT aspirant about a specific question they attempted, with the diagnosis already known. Socratic by default, explain the SEQUENCE not just the answer when needed. 2–6 sentences. Reference the diagnosis when relevant.`;

function buildTutorPrompt(input: {
  questionContext: {
    topic: string;
    subtopic: string;
    questionText: string;
    options: string[];
    correctIndex: number;
    explanation: string | null;
  };
  diagnosis: Diagnosis | null;
  history: TutorTurn[];
}): string {
  const letters = ["A", "B", "C", "D"];
  const ctx = `QUESTION CONTEXT
Topic: ${input.questionContext.topic} / ${input.questionContext.subtopic}
Stem: ${input.questionContext.questionText}
A) ${input.questionContext.options[0]}
B) ${input.questionContext.options[1]}
C) ${input.questionContext.options[2]}
D) ${input.questionContext.options[3]}
Correct: ${letters[input.questionContext.correctIndex]}
Worked solution: ${input.questionContext.explanation ?? "—"}

DIAGNOSIS:
${input.diagnosis ? `errorType: ${input.diagnosis.errorType}\nreasoningScore: ${input.diagnosis.reasoningScore}/10\ndiagnosis: ${input.diagnosis.diagnosis}\ncorrection: ${input.diagnosis.correction}\npattern: ${input.diagnosis.patternAlert ?? "—"}` : "(none)"}

CONVERSATION:
${input.history.map((t) => `${t.role.toUpperCase()}: ${t.content}`).join("\n")}

Reply as the tutor.`;
  return ctx;
}

async function anthropicTutor(
  client: Anthropic,
  input: {
    questionContext: {
      topic: string;
      subtopic: string;
      questionText: string;
      options: string[];
      correctIndex: number;
      explanation: string | null;
    };
    diagnosis: Diagnosis | null;
    history: TutorTurn[];
  },
): Promise<string> {
  const letters = ["A", "B", "C", "D"];
  const ctx = `QUESTION CONTEXT
Topic: ${input.questionContext.topic} / ${input.questionContext.subtopic}
Stem: ${input.questionContext.questionText}
Options:
  A) ${input.questionContext.options[0]}
  B) ${input.questionContext.options[1]}
  C) ${input.questionContext.options[2]}
  D) ${input.questionContext.options[3]}
Correct: ${letters[input.questionContext.correctIndex]}
Worked solution: ${input.questionContext.explanation ?? "—"}

DIAGNOSIS
${input.diagnosis ? `errorType: ${input.diagnosis.errorType}\nreasoningScore: ${input.diagnosis.reasoningScore}/10\ndiagnosis: ${input.diagnosis.diagnosis}\ncorrection: ${input.diagnosis.correction}\npatternAlert: ${input.diagnosis.patternAlert ?? "—"}` : "(none)"}`;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: ctx + "\n\nThe student will reply next." },
    { role: "assistant", content: "Understood — ready to tutor." },
    ...input.history.map((t) => ({ role: t.role, content: t.content })),
  ];

  const message = await client.messages.create({
    model: MODELS.workhorse,
    max_tokens: 800,
    system: [{ type: "text", text: TUTOR_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages,
  });
  const block = message.content.find((b) => b.type === "text");
  return block?.type === "text" ? block.text.trim() : localTutorReply(input);
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, isFinite(n) ? n : lo));
}
function clampInt(n: number, lo: number, hi: number) {
  return Math.round(clamp(n, lo, hi));
}
