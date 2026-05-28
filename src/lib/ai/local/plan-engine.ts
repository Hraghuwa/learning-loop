/**
 * Local 4-week study plan synthesizer.
 * Picks weekly focus from the student's weakest axis + recurring patterns.
 */

import type { StudyPlan } from "../claude-types";

type PlanInput = {
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
};

const FOCUS_DRILLS: Record<string, { task: string; minutes: number }[]> = {
  Quantitative: [
    { task: "Quant: 5 mixed Arithmetic questions, capture reasoning.", minutes: 35 },
    { task: "Quant: 3 Algebra problems with verify step explicit.", minutes: 30 },
    { task: "Quant: 2 Geometry problems with full diagram labelling.", minutes: 25 },
    { task: "Quant: 5 Modern Math counting problems, ordered-vs-unordered fork written out.", minutes: 30 },
    { task: "Quant review: re-read 3 wrong attempts, write a one-line lesson each.", minutes: 20 },
  ],
  VARC: [
    { task: "VARC: 1 RC passage, force-tag the pivot word and author stance.", minutes: 25 },
    { task: "VARC: 5 Sentence Corrections, mark subject-verb-object before reading options.", minutes: 20 },
    { task: "VARC: 2 Para Jumbles with topic-sentence circled before sequencing.", minutes: 20 },
    { task: "VARC: re-read 2 wrong RC attempts and rewrite the inference in one sentence.", minutes: 25 },
    { task: "VARC: 1 RC passage timed (8 min) — focus on speed at acceptable accuracy.", minutes: 12 },
  ],
  DILR: [
    { task: "DILR: 1 Arrangement set, write the strongest-clue chain before solving.", minutes: 35 },
    { task: "DILR: 1 Puzzle set, look for invariants before brute force.", minutes: 35 },
    { task: "DILR: 1 graph-or-table set, list 'what's asked' explicitly.", minutes: 30 },
    { task: "DILR review: re-read 2 wrong sets and identify the missed clue.", minutes: 25 },
    { task: "DILR: 1 timed full set (35 min) at exam pace.", minutes: 35 },
  ],
  Reasoning: [
    { task: "Mixed: 5 questions with reasoning >40 words and explicit verify step.", minutes: 40 },
    { task: "Re-attempt 3 wrong attempts; aim for reasoningScore ≥ 7 on each.", minutes: 30 },
    { task: "Choose 3 questions you got right with thin reasoning; rewrite the chain properly.", minutes: 25 },
    { task: "5 questions with the rule: state principle → execute → verify, every time.", minutes: 35 },
    { task: "Audit reasoning quality on your last 10 attempts — note hedging and misread patterns.", minutes: 20 },
  ],
};

const SUCCESS_SIGNALS: Record<string, string> = {
  Quantitative: "All Arithmetic and Algebra wrongs trace to a single named slip type — not 'I don't know'.",
  VARC: "RC accuracy on inference questions clears 70%.",
  DILR: "You can name the invariant or strongest-clue within 60 seconds of opening any set.",
  Reasoning: "Average reasoning score across the week ≥ 7/10.",
};

export function localStudyPlan(input: PlanInput): StudyPlan {
  const order = pickFocusOrder(input);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const minutesPerDay = Math.max(20, Math.round((input.weeklyHours * 60) / 6));

  const weeks = order.map((focus, i) => {
    const drills = FOCUS_DRILLS[focus] ?? FOCUS_DRILLS.Reasoning;
    const dailyDrills = days.slice(0, 6).map((day, idx) => {
      const drill = drills[idx % drills.length];
      return { day, task: drill.task, minutes: Math.min(drill.minutes, minutesPerDay) };
    });
    return {
      weekNumber: i + 1,
      focus,
      rationale: rationaleFor(focus, input),
      dailyDrills,
      successSignal: SUCCESS_SIGNALS[focus] ?? "Reasoning quality and accuracy in this focus area both move up by 1 step.",
    };
  });

  return {
    goal: `Move from current ~${Math.round(input.cognitiveProfile.percentile || 60)} to ${input.targetPercentile} percentile by drilling the highest-leverage habits first.`,
    weeklyHours: input.weeklyHours,
    weeks,
    guardrails: buildGuardrails(input),
  };
}

function pickFocusOrder(input: PlanInput): string[] {
  const axes: Array<[string, number]> = [
    ["Quantitative", input.cognitiveProfile.quant],
    ["VARC", input.cognitiveProfile.varc],
    ["DILR", input.cognitiveProfile.dilr],
  ];
  axes.sort((a, b) => a[1] - b[1]);
  const weakest = axes[0][0];
  const second = axes[1][0];
  const includesReasoning = input.cognitiveProfile.reasoning < 7 || input.topPatterns.length > 0;
  const order = [weakest, includesReasoning ? "Reasoning" : second, second, weakest];
  return order;
}

function rationaleFor(focus: string, input: PlanInput): string {
  if (focus === "Reasoning") {
    const top = input.topPatterns[0];
    return top
      ? `Recurring pattern detected: "${top.name}" (${top.severity}). One week on reasoning hygiene typically halves its frequency.`
      : "Reasoning quality compounds across all sections — cleaner reasoning lifts every other axis.";
  }
  const score = (input.cognitiveProfile as Record<string, number>)[focus.toLowerCase()] ?? 5;
  return `${focus} sits at ${score.toFixed(1)}/10 — the highest-leverage axis to lift this week.`;
}

function buildGuardrails(input: PlanInput): string[] {
  const out = [
    "Don't grind questions without reading the diagnosis afterwards — repetition without reflection wastes the rep.",
    "Don't skip reasoning capture — that's the entire premise of the loop.",
  ];
  if (input.weeklyHours >= 14) {
    out.push("Don't add more hours than this — diminishing returns kick in past ~2 hours/day.");
  }
  if ((input.cognitiveProfile.percentile || 0) < 70) {
    out.push("Don't take more than one full mock per week at this stage — fundamentals first.");
  }
  return out.slice(0, 4);
}
