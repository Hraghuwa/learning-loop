/**
 * Deterministic cognitive diagnosis.
 *
 * Pipeline:
 *   1. Extract reasoning signals (concept overlap, logic markers, numeric content...).
 *   2. Map signals → reasoning score (0-10 rubric).
 *   3. Map signals + outcome → error-type label.
 *   4. Generate diagnosis & correction prose by composing templates parameterised
 *      by the question's topic / subtopic and the matched/missing concepts.
 *   5. Detect a recurring "pattern alert" via second-pass signal interpretation.
 *
 * No network. No model. Runs in ~1ms per attempt.
 */

import type { Diagnosis } from "../claude-types";
import { extractSignals } from "./concept-extractor";
import { findArithmeticErrors, fmtNum } from "./arithmetic-verifier";

type Input = {
  questionText: string;
  topic: string;
  subtopic: string;
  options: string[];
  correctIndex: number;
  selectedIndex: number;
  reasoning: string;
  explanation?: string | null;
};

const TOPIC_HINTS: Record<string, { discriminator: string; classicTrap: string }> = {
  "Quantitative/Arithmetic": {
    discriminator: "the constraint on units, sign, or rounding",
    classicTrap: "applying a percent on the wrong base",
  },
  "Quantitative/Algebra": {
    discriminator: "the discriminant, root validity, or domain restriction",
    classicTrap: "skipping an extraneous-root check after squaring",
  },
  "Quantitative/Geometry": {
    discriminator: "the implicit symmetry or auxiliary line",
    classicTrap: "assuming a triangle is right when it is not",
  },
  "Quantitative/Modern Math": {
    discriminator: "the definition of 'with' vs 'without' replacement and order",
    classicTrap: "double-counting indistinguishable arrangements",
  },
  "VARC/Reading Comprehension": {
    discriminator: "the author's pivot word ('yet', 'but', 'however')",
    classicTrap: "picking an option that is true but off-scope",
  },
  "VARC/Sentence Correction": {
    discriminator: "subject-verb agreement and the nearest noun rule",
    classicTrap: "letting a long modifier mask the actual subject",
  },
  "VARC/Para Jumbles": {
    discriminator: "the topic-sentence and the pivot/contrast cue",
    classicTrap: "connecting two pronouns to the wrong antecedent",
  },
  "DILR/Arrangements": {
    discriminator: "the strongest single-fix clue and adjacency rules",
    classicTrap: "missing that 'between' may or may not mean adjacent",
  },
  "DILR/Puzzles": {
    discriminator: "the invariant or counting trick",
    classicTrap: "trying brute force when a parity argument cuts it short",
  },
};

const NEXT_TOPIC_NUDGES: Record<string, string> = {
  "Quantitative/Arithmetic": "Mixture, alligation, and percentage-on-wrong-base drills",
  "Quantitative/Algebra": "Quadratic-roots edge cases and log/exponent identities",
  "Quantitative/Geometry": "Inradius/circumradius, similarity, and auxiliary-line drills",
  "Quantitative/Modern Math": "Counting with restrictions and probability conditionals",
  "VARC/Reading Comprehension": "Inference vs. fact, and tone identification with pivots",
  "VARC/Sentence Correction": "Modifier placement and subject-verb proximity traps",
  "VARC/Para Jumbles": "Topic-sentence detection and pivot anchoring",
  "DILR/Arrangements": "Single-fix clue identification and adjacency disambiguation",
  "DILR/Puzzles": "Parity, invariants, and pigeonhole reasoning",
};

export function localDiagnose(input: Input): Diagnosis {
  const { topic, subtopic } = input;
  const isCorrect = input.selectedIndex === input.correctIndex;
  const sig = extractSignals(input.reasoning, {
    questionText: input.questionText,
    explanation: input.explanation ?? null,
    subtopic,
  });

  const score = scoreReasoning(sig, isCorrect);
  const errorType = classifyError(sig, isCorrect, score);

  const key = `${topic}/${subtopic}`;
  const hint = TOPIC_HINTS[key] ?? { discriminator: "the constraint you didn't lock onto", classicTrap: "leaping past one verification step" };

  const diagnosis = composeDiagnosis({ errorType, isCorrect, sig, hint });
  const correction = composeCorrection({ errorType, sig, hint, subtopic });
  const patternAlert = composePatternAlert(errorType, sig, isCorrect);
  const next = NEXT_TOPIC_NUDGES[key] ?? `${topic} / ${subtopic} drills`;

  const cognitiveMoves = describeMoves(sig);

  const base: Diagnosis = {
    errorType,
    diagnosis,
    correction,
    reasoningScore: score,
    patternAlert,
    nextPracticeTopic: next,
    confidence: estimateConfidence(sig, score, errorType),
    cognitiveMoves,
  };

  // Deterministic upgrade: if the student stated a numeric step we can
  // independently prove wrong, replace the heuristic guess with a surgical,
  // evidence-backed Calculation Error. Only fires on a proven mismatch — when
  // nothing is provable, `base` is returned unchanged (no false certainty).
  const verified = topic.startsWith("Quantitative")
    ? findArithmeticErrors(input.reasoning)
    : [];
  if (verified.length > 0) {
    const e = verified[0];
    const more =
      verified.length > 1 ? ` (${verified.length} such steps detected.)` : "";
    return {
      ...base,
      errorType: "Calculation Error",
      diagnosis: `Verified arithmetic slip: you wrote "${e.claim}", but ${e.lhs} = ${fmtNum(e.actual)}, not ${fmtNum(e.stated)}.${more} The approach may be sound — the execution broke at this step.`,
      correction: `Correct the step itself: ${e.lhs} = ${fmtNum(e.actual)}. Re-run the chain from there before trusting the final value. ${base.correction}`,
      confidence: Math.max(base.confidence, 0.92),
      cognitiveMoves: Array.from(
        new Set([...base.cognitiveMoves, "made a verifiable arithmetic slip"]),
      ).slice(0, 6),
    };
  }

  return base;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function scoreReasoning(sig: ReturnType<typeof extractSignals>, isCorrect: boolean): number {
  if (sig.wordCount < 5) return 0;
  if (sig.wordCount < 10) return 2;

  let s = 3;
  if (sig.domainTerms.length >= 1) s += 1;
  if (sig.hasCausal) s += 1;
  if (sig.hasConstraintTalk) s += 1;
  if (sig.conceptOverlap > 0.25) s += 1;
  if (sig.conceptOverlap > 0.5) s += 1;
  if (sig.hasVerification) s += 1;
  if (sig.matchedExplanationPhrases.length > 0) s += 1;
  if (isCorrect && (sig.hasCausal || sig.conceptOverlap > 0.3)) s += 1;
  if (sig.hasHedging) s -= 1;
  if (sig.hasElimination && sig.hasConstraintTalk) s += 1;

  return Math.max(0, Math.min(10, Math.round(s)));
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

function classifyError(
  sig: ReturnType<typeof extractSignals>,
  isCorrect: boolean,
  score: number,
): Diagnosis["errorType"] {
  if (sig.wordCount < 5) return "No Reasoning Provided";
  if (isCorrect && score >= 7) return "Correct Reasoning";
  if (isCorrect && score < 5) {
    // Right answer with thin reasoning — still flag as a thinking habit.
    return "Assumption Error";
  }

  if (sig.numericContent >= 3 && sig.operatorContent && score >= 6) {
    return "Calculation Error";
  }
  if (sig.conceptOverlap < 0.2 && sig.domainTerms.length === 0) {
    return "Conceptual Gap";
  }
  if (sig.hasHedging && !sig.hasVerification) {
    return "Assumption Error";
  }
  if (sig.hasConstraintTalk && !sig.hasVerification && !isCorrect) {
    return "Misread Question";
  }
  if (sig.numericContent >= 2 && score < 5) {
    return "Calculation Error";
  }
  if (sig.hasElimination && !isCorrect) {
    return "Shortcut Missed";
  }
  return "Assumption Error";
}

// ---------------------------------------------------------------------------
// Diagnosis prose
// ---------------------------------------------------------------------------

function composeDiagnosis({
  errorType,
  isCorrect,
  sig,
  hint,
}: {
  errorType: Diagnosis["errorType"];
  isCorrect: boolean;
  sig: ReturnType<typeof extractSignals>;
  hint: { discriminator: string; classicTrap: string };
}): string {
  const overlapPct = Math.round(sig.conceptOverlap * 100);
  const moves = sig.matchedExplanationPhrases.length;
  const conceptHit =
    sig.matchedExplanationPhrases[0] && sig.matchedExplanationPhrases[0].length > 8
      ? `you did anchor on "${sig.matchedExplanationPhrases[0]}"`
      : "you didn't lean on the canonical concept of this question";

  switch (errorType) {
    case "Correct Reasoning":
      return `Clean attempt — your chain held together. The reasoning maps onto the canonical solution at roughly ${overlapPct}% concept overlap and you stated the causal step explicitly. Keep this rhythm.`;
    case "Conceptual Gap":
      return `The chain shows weak contact with the actual concept under test. Your reasoning landed on general impressions rather than the specific principle (${hint.discriminator}). Concept overlap was ~${overlapPct}%.`;
    case "Calculation Error":
      return `Your method looked viable — ${conceptHit} — but the numeric chain has the kind of slip that classic ${hint.classicTrap} produces. ${moves > 0 ? "You named the right idea but didn't carry it cleanly." : "The arithmetic step lost the constraint."}`;
    case "Misread Question":
      return `You spoke about constraints but didn't verify them against each option. That's the signature of a misread: the right framing, the wrong target. ${conceptHit}.`;
    case "Shortcut Missed":
      return `You eliminated options without anchoring on ${hint.discriminator}. Elimination without anchoring is the fast lane to the trap — the test designers count on it.`;
    case "Assumption Error":
      if (isCorrect) {
        return `Right answer, thin reasoning. Concept overlap was ~${overlapPct}% and ${sig.hasHedging ? "you hedged" : "you skipped the verification step"}. A correct answer with weak reasoning is a future failure under timed pressure.`;
      }
      return `An unjustified leap broke the chain. Your reasoning had the right vocabulary but skipped past ${hint.discriminator}. Don't trust the option that "feels right" until you can name why.`;
    case "No Reasoning Provided":
      return `Reasoning is the practice. A blank or near-blank attempt is a missed rep, even if you got the answer right.`;
  }
}

// ---------------------------------------------------------------------------
// Correction prose
// ---------------------------------------------------------------------------

function composeCorrection({
  errorType,
  sig,
  hint,
  subtopic,
}: {
  errorType: Diagnosis["errorType"];
  sig: ReturnType<typeof extractSignals>;
  hint: { discriminator: string; classicTrap: string };
  subtopic: string;
}): string {
  const next = `Anchor on ${hint.discriminator}.`;
  const verify = sig.hasVerification
    ? "Keep the verification habit — it's already saving you on borderline calls."
    : "Add an explicit verify step: after picking, plug the answer back into the constraint.";

  switch (errorType) {
    case "Correct Reasoning":
      return `Lock in this routine: state the principle, execute, verify. ${verify} Push toward the harder cuts in ${subtopic} where the discriminator is subtler.`;
    case "Conceptual Gap":
      return `Re-derive the core concept of ${subtopic} from a single example before attempting the next problem. ${next} ${verify}`;
    case "Calculation Error":
      return `Slow the arithmetic step by 20% — most calc errors are speed taxes. ${next} ${verify} The trap here was ${hint.classicTrap}.`;
    case "Misread Question":
      return `Read each constraint twice and circle the one that uniquely discriminates between options. ${next} ${verify}`;
    case "Shortcut Missed":
      return `Before eliminating, name what would make each option survive. The option that survives the strictest test is the answer. ${next} ${verify}`;
    case "Assumption Error":
      return `Rebuild the chain link by link, no skipped steps. State the principle, the constraint, the calculation, the check. ${next} ${verify}`;
    case "No Reasoning Provided":
      return `Even one sentence helps: "I picked X because constraint Y forces Z." Do that next time and we can give you a real diagnosis.`;
  }
}

// ---------------------------------------------------------------------------
// Pattern alert
// ---------------------------------------------------------------------------

function composePatternAlert(
  errorType: Diagnosis["errorType"],
  sig: ReturnType<typeof extractSignals>,
  isCorrect: boolean,
): string | null {
  if (errorType === "Correct Reasoning" && sig.hasVerification) return null;
  if (sig.hasHedging && !isCorrect) return "Hedging without verifying — when uncertain, you commit instead of checking.";
  if (sig.hasElimination && !sig.hasConstraintTalk) return "Eliminating before anchoring — your fastest mistake mode.";
  if (!sig.hasVerification && sig.wordCount > 30) return "Long reasoning, no verification — you write the path but skip the check.";
  if (errorType === "Misread Question") return "Reading the stem fast and skimming over qualifiers.";
  if (errorType === "Conceptual Gap") return "Reaching for vocabulary you haven't fully cemented.";
  return null;
}

function describeMoves(sig: ReturnType<typeof extractSignals>): string[] {
  const moves: string[] = [];
  if (sig.wordCount > 0) moves.push("framed the attempt");
  if (sig.domainTerms.length) moves.push(`invoked ${sig.domainTerms.slice(0, 2).join(", ")}`);
  if (sig.hasConstraintTalk) moves.push("named a constraint");
  if (sig.hasCausal) moves.push("articulated a causal link");
  if (sig.numericContent >= 2 && sig.operatorContent) moves.push("executed a numeric step");
  if (sig.hasElimination) moves.push("eliminated options");
  if (sig.hasVerification) moves.push("verified the choice");
  if (sig.hasHedging) moves.push("hedged on confidence");
  return moves.slice(0, 6);
}

function estimateConfidence(
  sig: ReturnType<typeof extractSignals>,
  score: number,
  errorType: Diagnosis["errorType"],
): number {
  if (errorType === "No Reasoning Provided") return 0.95;
  let c = 0.5;
  if (sig.matchedExplanationPhrases.length > 0) c += 0.15;
  if (sig.domainTerms.length >= 2) c += 0.1;
  if (sig.wordCount > 30) c += 0.1;
  if (score >= 8 || score <= 2) c += 0.1;
  return Math.min(0.95, Math.max(0.3, c));
}
