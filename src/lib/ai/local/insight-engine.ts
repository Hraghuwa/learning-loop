/**
 * Statistical cross-session synthesis — runs entirely from sessions data.
 *
 * Approach:
 *   - Cluster attempts by error type and topic.
 *   - Compute a linear trajectory over the last N reasoning scores.
 *   - Rank recurring patterns by frequency × severity.
 *   - Project percentile from current EMA + trajectory slope.
 *   - Synthesise prose by composing templates.
 */

import type { Insight, SessionDigest } from "../claude-types";

const MIN_FOR_PATTERN = 3;
const MIN_TOTAL = 5;

type Profile = {
  quant: number;
  varc: number;
  dilr: number;
  reasoning: number;
  speed: number;
  accuracy: number;
  percentile: number;
  totalSessions: number;
};

export function localInsight(input: {
  studentName: string;
  cognitiveProfile: Profile;
  recentSessions: SessionDigest[];
}): Insight {
  const sessions = input.recentSessions;

  if (sessions.length < MIN_TOTAL) {
    return {
      headline: "Building your cognitive baseline",
      summary: `You're at ${sessions.length} attempts. We need ${MIN_TOTAL - sessions.length} more before patterns become visible. Keep going — every reasoning capture trains the model.`,
      recurringPatterns: [],
      strengths: [],
      trajectory: "early",
      trajectoryReason: "Insufficient data.",
      projectedPercentile: input.cognitiveProfile.percentile || 60,
      topRecommendations: [
        {
          action: `Solve ${MIN_TOTAL - sessions.length} more questions across all three sections, with reasoning enabled.`,
          why: "Cross-section coverage is required before stable patterns emerge.",
          estimatedDays: 3,
        },
      ],
    };
  }

  const errorCounts = countBy(sessions, (s) => s.errorType ?? "Unknown");
  const topicAccuracy = computeTopicAccuracy(sessions);
  const trajectory = computeTrajectory(sessions);
  const projected = projectPercentile(input.cognitiveProfile, trajectory);

  const recurringPatterns = buildPatterns(errorCounts, sessions);
  const strengths = buildStrengths(input.cognitiveProfile, topicAccuracy, sessions);
  const recommendations = buildRecommendations(errorCounts, topicAccuracy, trajectory);

  const dominant = recurringPatterns[0];
  const headline = dominant
    ? toHeadline(dominant.name, trajectory.label)
    : trajectory.label === "rising"
      ? "Steady climb across the board"
      : "Holding steady — time to pick a focus";

  const summary = composeSummary({
    name: input.studentName,
    sessions: sessions.length,
    accuracy: pct(sessions.filter((s) => s.isCorrect).length / sessions.length),
    avgReason: avg(sessions.map((s) => s.reasoningScore)),
    dominant,
    trajectory,
  });

  return {
    headline,
    summary,
    recurringPatterns,
    strengths,
    trajectory: trajectory.label,
    trajectoryReason: trajectory.reason,
    projectedPercentile: projected,
    topRecommendations: recommendations,
  };
}

// ---------------------------------------------------------------------------

function countBy<T>(arr: T[], key: (t: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const item of arr) {
    const k = key(item);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function pct(x: number) {
  return Math.round(x * 100);
}

type TopicAccuracy = Map<string, { topic: string; subtopic: string; correct: number; total: number; reasoningAvg: number }>;

function computeTopicAccuracy(sessions: SessionDigest[]): TopicAccuracy {
  const m: TopicAccuracy = new Map();
  for (const s of sessions) {
    const key = `${s.topic}/${s.subtopic}`;
    const cur =
      m.get(key) ?? { topic: s.topic, subtopic: s.subtopic, correct: 0, total: 0, reasoningAvg: 0 };
    cur.total += 1;
    if (s.isCorrect) cur.correct += 1;
    cur.reasoningAvg += s.reasoningScore;
    m.set(key, cur);
  }
  for (const v of m.values()) v.reasoningAvg = v.reasoningAvg / Math.max(1, v.total);
  return m;
}

type Trajectory = { label: Insight["trajectory"]; slope: number; reason: string };

function computeTrajectory(sessions: SessionDigest[]): Trajectory {
  // Sessions are newest-first; reverse for chronological.
  const chrono = [...sessions].reverse();
  if (chrono.length < MIN_TOTAL) {
    return { label: "early", slope: 0, reason: "Not enough attempts yet." };
  }
  const half = Math.floor(chrono.length / 2);
  const earlyAvg = avg(chrono.slice(0, half).map((s) => s.reasoningScore));
  const lateAvg = avg(chrono.slice(half).map((s) => s.reasoningScore));
  const slope = lateAvg - earlyAvg;

  if (slope > 0.7) {
    return {
      label: "rising",
      slope,
      reason: `Reasoning average climbed from ${earlyAvg.toFixed(1)} to ${lateAvg.toFixed(1)} across the last ${chrono.length} attempts.`,
    };
  }
  if (slope < -0.7) {
    return {
      label: "regressing",
      slope,
      reason: `Reasoning average dropped from ${earlyAvg.toFixed(1)} to ${lateAvg.toFixed(1)} — likely fatigue or a topic shift.`,
    };
  }
  return {
    label: "plateau",
    slope,
    reason: `Reasoning average held near ${lateAvg.toFixed(1)} — no clear directional change in the last ${chrono.length} attempts.`,
  };
}

function projectPercentile(p: Profile, t: Trajectory): number {
  const base = p.percentile || 60;
  const bump = t.label === "rising" ? 6 : t.label === "regressing" ? -4 : 1;
  return Math.max(1, Math.min(99.5, base + bump));
}

function buildPatterns(errorCounts: Map<string, number>, sessions: SessionDigest[]) {
  const total = sessions.length;
  const out: Insight["recurringPatterns"] = [];
  const sorted = [...errorCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [name, count] of sorted) {
    if (count < MIN_FOR_PATTERN) continue;
    if (name === "Correct Reasoning" || name === "Unknown" || name === "No Reasoning Provided") continue;

    const ratio = count / total;
    const severity: "low" | "medium" | "high" = ratio > 0.4 ? "high" : ratio > 0.2 ? "medium" : "low";
    const example = sessions.find((s) => s.errorType === name && s.diagnosis);
    const evidence = example?.diagnosis
      ? snippet(example.diagnosis, 140)
      : `${count} attempts in the recent set were classified as ${name}.`;
    out.push({ name: humanizePattern(name), evidence, severity });
    if (out.length >= 4) break;
  }
  return out;
}

function humanizePattern(errorType: string): string {
  switch (errorType) {
    case "Conceptual Gap":
      return "Foundational concept gap";
    case "Calculation Error":
      return "Speed-tax arithmetic slips";
    case "Misread Question":
      return "Skimming past stem qualifiers";
    case "Shortcut Missed":
      return "Eliminating before anchoring";
    case "Assumption Error":
      return "Unjustified leaps in the chain";
    default:
      return errorType;
  }
}

function buildStrengths(profile: Profile, topicAcc: TopicAccuracy, sessions: SessionDigest[]) {
  const out: string[] = [];
  const axes: Array<[string, number]> = [
    ["Quantitative", profile.quant],
    ["VARC", profile.varc],
    ["DILR", profile.dilr],
  ];
  axes.sort((a, b) => b[1] - a[1]);
  if (axes[0][1] >= 7) out.push(`Strong baseline in ${axes[0][0]} (${axes[0][1].toFixed(1)}/10).`);
  if (profile.reasoning >= 7) out.push(`Reasoning-quality average above 7 — your diagnoses are getting cleaner.`);
  if (profile.speed >= 7) out.push(`Solving pace is competitive — you don't burn time even on hard items.`);

  // Subtopic-level strength.
  const sortedSubs = [...topicAcc.values()]
    .filter((v) => v.total >= 2)
    .sort((a, b) => b.correct / b.total - a.correct / a.total);
  if (sortedSubs[0] && sortedSubs[0].correct / sortedSubs[0].total >= 0.75) {
    out.push(
      `${sortedSubs[0].topic} / ${sortedSubs[0].subtopic} is a green zone (${sortedSubs[0].correct}/${sortedSubs[0].total} correct).`,
    );
  }

  // Recent crisp attempt as evidence.
  const crisp = sessions.find((s) => s.reasoningScore >= 8);
  if (crisp && out.length < 3) {
    out.push(
      `Capable of ${crisp.reasoningScore}/10 reasoning — see your ${crisp.topic} / ${crisp.subtopic} attempt.`,
    );
  }
  return out.slice(0, 4);
}

function buildRecommendations(
  errorCounts: Map<string, number>,
  topicAcc: TopicAccuracy,
  trajectory: Trajectory,
): Insight["topRecommendations"] {
  const recs: Insight["topRecommendations"] = [];

  // Top error type → corrective action.
  const errEntries = [...errorCounts.entries()]
    .filter(([k]) => k !== "Correct Reasoning" && k !== "No Reasoning Provided")
    .sort((a, b) => b[1] - a[1]);
  const topError = errEntries[0]?.[0];
  if (topError) {
    recs.push({
      action: actionForError(topError),
      why: `${errEntries[0][1]} of your recent attempts were classified as ${topError}.`,
      estimatedDays: 7,
    });
  }

  // Weakest subtopic with at least 3 attempts.
  const weakSubs = [...topicAcc.values()]
    .filter((v) => v.total >= 3)
    .sort((a, b) => a.correct / a.total - b.correct / b.total);
  if (weakSubs[0]) {
    const w = weakSubs[0];
    recs.push({
      action: `Drill 5 questions in ${w.topic} / ${w.subtopic} this week with reasoning enabled.`,
      why: `Lowest accuracy zone (${w.correct}/${w.total}) and reasoning average ${w.reasoningAvg.toFixed(1)}/10.`,
      estimatedDays: 7,
    });
  }

  // Trajectory-tied advice.
  if (trajectory.label === "regressing") {
    recs.push({
      action: "Take a 24-hour rest day, then return with one easy review block.",
      why: "Your reasoning average is declining — fatigue is the most common cause.",
      estimatedDays: 2,
    });
  } else if (trajectory.label === "plateau") {
    recs.push({
      action: "Add 1 timed mock test this week to introduce stress and break the plateau.",
      why: "Plateaus break under context shift, not more reps.",
      estimatedDays: 7,
    });
  } else if (trajectory.label === "rising") {
    recs.push({
      action: "Push difficulty up one notch in your strongest subtopic.",
      why: "You're improving — the next gain is from a harder ceiling, not more easy reps.",
      estimatedDays: 7,
    });
  }

  return recs.slice(0, 3);
}

function actionForError(errorType: string): string {
  switch (errorType) {
    case "Conceptual Gap":
      return "Re-watch / re-read the foundation chapter for your weakest topic before more practice.";
    case "Calculation Error":
      return "Slow your arithmetic by 20% on the next 10 questions and verify each.";
    case "Misread Question":
      return "Adopt a 'circle the qualifiers' habit — read each stem twice before picking.";
    case "Shortcut Missed":
      return "Before eliminating, write the discriminator that would save each option.";
    case "Assumption Error":
      return "Add an explicit 'verify' step to every attempt — substitute or sanity-check.";
    default:
      return "Capture richer reasoning on the next 10 attempts to tighten the diagnosis loop.";
  }
}

function composeSummary({
  name,
  sessions,
  accuracy,
  avgReason,
  dominant,
  trajectory,
}: {
  name: string;
  sessions: number;
  accuracy: number;
  avgReason: number;
  dominant: Insight["recurringPatterns"][number] | undefined;
  trajectory: Trajectory;
}): string {
  const greet = name && name !== "Student" ? `${name}, ` : "";
  const trajLine =
    trajectory.label === "rising"
      ? "Trend is rising — your reasoning quality is improving."
      : trajectory.label === "regressing"
        ? "Trend is regressing — likely fatigue or a topic shift."
        : trajectory.label === "plateau"
          ? "Trend is flat — you've stabilised, but no growth in the last block."
          : "Still building baseline.";

  const dominantLine = dominant
    ? `The dominant cognitive habit visible in the data is ${dominant.name.toLowerCase()} (${dominant.severity} severity). That's the lever this week.`
    : `No single error dominates yet — variance is healthy at this stage.`;

  return `${greet}across the last ${sessions} attempts you're at ${accuracy}% accuracy with an average reasoning score of ${avgReason.toFixed(1)}/10. ${trajLine} ${dominantLine}`;
}

function toHeadline(patternName: string, trajectory: Insight["trajectory"]): string {
  if (trajectory === "rising") return `Rising — but ${patternName.toLowerCase()} is still costing you`;
  if (trajectory === "regressing") return `Slipping under ${patternName.toLowerCase()}`;
  if (trajectory === "early") return "Early days — patterns just starting to emerge";
  return `Plateau driven by ${patternName.toLowerCase()}`;
}

function snippet(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
