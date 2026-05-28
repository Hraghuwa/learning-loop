/**
 * Template + intent-classifier tutor.
 *
 * Recognises the student's intent, then composes a response from
 * the question's stem, the correct answer's path, and the prior diagnosis.
 *
 * No model. Deterministic. Surprisingly coherent for the common cases.
 */

import type { Diagnosis, TutorTurn } from "../claude-types";

type Question = {
  topic: string;
  subtopic: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
};

type Intent =
  | "walkthrough"
  | "where-wrong"
  | "shortcut"
  | "rephrase"
  | "more-practice"
  | "encouragement"
  | "general";

const INTENT_RULES: Array<{ test: RegExp; intent: Intent }> = [
  { test: /\b(walk|step[\s-]*by[\s-]*step|how to solve|guide me|explain.*solution|full solution|complete solution)\b/i, intent: "walkthrough" },
  { test: /\b(where.*(wrong|miss|break)|why.*(wrong|incorrect)|what did i miss|where.*break)\b/i, intent: "where-wrong" },
  { test: /\b(shortcut|faster|quicker|trick|shorter|tip|hack)\b/i, intent: "shortcut" },
  { test: /\b(rephrase|simpler|simpl(er|y)|in plain.*english|easier)\b/i, intent: "rephrase" },
  { test: /\b(another|similar|more.*like.*this|practice.*same)\b/i, intent: "more-practice" },
  { test: /\b(stuck|confused|frustrat|give up|hate this|too hard)\b/i, intent: "encouragement" },
];

export function localTutorReply(input: {
  questionContext: Question;
  diagnosis: Diagnosis | null;
  history: TutorTurn[];
}): string {
  const lastUserMsg = [...input.history].reverse().find((t) => t.role === "user")?.content ?? "";
  const intent = classifyIntent(lastUserMsg);
  return respond(intent, input.questionContext, input.diagnosis, lastUserMsg, input.history);
}

function classifyIntent(text: string): Intent {
  for (const rule of INTENT_RULES) if (rule.test.test(text)) return rule.intent;
  return "general";
}

function respond(
  intent: Intent,
  q: Question,
  d: Diagnosis | null,
  userMsg: string,
  history: TutorTurn[],
): string {
  const correctLetter = "ABCD"[q.correctIndex];
  const correctOption = q.options[q.correctIndex];

  switch (intent) {
    case "walkthrough":
      return composeWalkthrough(q, correctLetter, correctOption);
    case "where-wrong":
      return composeWhereWrong(q, d);
    case "shortcut":
      return composeShortcut(q);
    case "rephrase":
      return composeRephrase(q);
    case "more-practice":
      return `Yes — head to your Practice page and look for the “Recommended” section. Items in ${q.topic} / ${q.subtopic} that target the same pattern will appear there.`;
    case "encouragement":
      return composeEncouragement(d);
    case "general":
      return composeGeneral(q, d, userMsg, history.length);
  }
}

function composeWalkthrough(q: Question, letter: string, option: string): string {
  if (q.explanation && q.explanation.length > 30) {
    const cleaned = q.explanation.replace(/\s+/g, " ").trim();
    return `Here's the canonical path for this ${q.subtopic} question:\n\n${cleaned}\n\nThe answer that survives every constraint is ${letter}) ${option}.`;
  }
  return `For ${q.subtopic}, the disciplined sequence is: (1) restate the constraints, (2) compute or eliminate, (3) verify against every constraint before locking in. Doing that here lands you on ${letter}) ${option}.`;
}

function composeWhereWrong(q: Question, d: Diagnosis | null): string {
  if (d) {
    const corr = d.correction ? ` ${d.correction}` : "";
    return `Looking at your attempt: ${d.diagnosis}${corr}`;
  }
  return `Without a captured reasoning trace, I can only point to the most common trap on ${q.subtopic} — leaping past one constraint check. Re-read the stem and circle each qualifier; the option that satisfies all of them is the answer.`;
}

function composeShortcut(q: Question): string {
  const tips: Record<string, string> = {
    Arithmetic: "On percentage and ratio problems, ballpark with simple numbers (10, 100) before committing to algebra.",
    Algebra: "On quadratics, check the discriminant first; on log problems, combine before exponentiating.",
    Geometry: "Draw the figure even if it's given — labelling sides usually reveals an auxiliary triangle.",
    "Modern Math": "On counting, decide ordered vs unordered first — that single fork halves your wrong paths.",
    "Reading Comprehension": "Find the pivot word ('yet', 'however', 'but') — the author's stance lives on the side after it.",
    "Sentence Correction": "Strip the sentence to subject-verb-object; modifiers come last.",
    "Para Jumbles": "The topic sentence rarely starts with a pronoun. Find it first.",
    Arrangements: "Find the strongest single-fix clue and pin it before anything else.",
    Puzzles: "Ask 'what's invariant?' before brute-forcing — the trick is usually a parity or counting argument.",
  };
  const tip = tips[q.subtopic] ?? "Anchor on the strongest clue first; everything else cascades.";
  return tip;
}

function composeRephrase(q: Question): string {
  const stem = q.questionText.length > 280 ? q.questionText.slice(0, 277) + "…" : q.questionText;
  return `In plain terms: the question is asking you to find the option that satisfies all of the constraints in the stem. The constraints, restated:\n\n• ${stem}\n\nWork backward from the options if forward feels stuck.`;
}

function composeEncouragement(d: Diagnosis | null): string {
  if (d && d.reasoningScore >= 5) {
    return `Your reasoning isn't broken — you scored ${d.reasoningScore}/10, which means the chain mostly held. The fix is local, not foundational. Take a short break and come back to one easier rep.`;
  }
  return `Stuck is a phase, not a verdict. Drop to one easier question in this subtopic, capture the reasoning, and let the diagnosis tell us what to do next.`;
}

function composeGeneral(q: Question, d: Diagnosis | null, userMsg: string, turn: number): string {
  // First exchange: open Socratically.
  if (turn <= 1) {
    if (d) {
      return `Tell me which step in your reasoning felt least certain. From the diagnosis: "${d.diagnosis}" — does that match how it felt?`;
    }
    return `Walk me to the first step where you felt unsure. We'll restart the chain from there.`;
  }
  // Acknowledge what they said and prompt forward.
  const echo = userMsg.length > 100 ? userMsg.slice(0, 97) + "…" : userMsg;
  return `Got it — "${echo}". Try this: re-read just the constraints in the stem and tell me which one rules out the option you picked. That's almost always where the click happens.`;
}
