// Lightweight SM-2-style spacing. Inputs come from session outcomes.

type ScheduleInput = {
  prevIntervalDays: number;
  prevEase: number;
  outcome: "correct" | "wrong" | "skipped";
  reasoningScore: number;
};

export function nextSchedule({
  prevIntervalDays,
  prevEase,
  outcome,
  reasoningScore,
}: ScheduleInput) {
  const ease = clamp(
    prevEase + (outcome === "correct" ? 0.1 : -0.2) + (reasoningScore >= 8 ? 0.05 : 0),
    1.3,
    3.0,
  );

  let intervalDays: number;
  if (outcome !== "correct") {
    intervalDays = 1; // reset on wrong
  } else if (prevIntervalDays === 0 || prevIntervalDays === 1) {
    intervalDays = reasoningScore >= 7 ? 4 : 2;
  } else {
    intervalDays = Math.round(prevIntervalDays * ease);
  }

  intervalDays = Math.min(intervalDays, 60);
  const dueAt = new Date(Date.now() + intervalDays * 86400000).toISOString();
  return { ease, intervalDays, dueAt };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
