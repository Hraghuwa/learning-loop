/**
 * Shared type contracts for the cognitive engine — used by both the
 * Anthropic-backed implementation (claude.ts) and the local engine
 * (lib/ai/local/*).
 */

export type Diagnosis = {
  errorType:
    | "Conceptual Gap"
    | "Calculation Error"
    | "Misread Question"
    | "Shortcut Missed"
    | "Assumption Error"
    | "No Reasoning Provided"
    | "Correct Reasoning";
  diagnosis: string;
  correction: string;
  reasoningScore: number;
  patternAlert: string | null;
  nextPracticeTopic: string;
  confidence: number;
  cognitiveMoves: string[];
};

export type Insight = {
  headline: string;
  summary: string;
  recurringPatterns: { name: string; evidence: string; severity: "low" | "medium" | "high" }[];
  strengths: string[];
  trajectory: "rising" | "plateau" | "regressing" | "early";
  trajectoryReason: string;
  projectedPercentile: number;
  topRecommendations: { action: string; why: string; estimatedDays: number }[];
};

export type StudyPlan = {
  goal: string;
  weeklyHours: number;
  weeks: {
    weekNumber: number;
    focus: string;
    rationale: string;
    dailyDrills: { day: string; task: string; minutes: number }[];
    successSignal: string;
  }[];
  guardrails: string[];
};

export type SessionDigest = {
  topic: string;
  subtopic: string;
  difficulty: string;
  isCorrect: boolean;
  reasoningScore: number;
  errorType: string | null;
  diagnosis: string | null;
  patternAlert: string | null;
  reasoningSnippet: string | null;
  createdAt: string;
};

export type TutorTurn = { role: "user" | "assistant"; content: string };
