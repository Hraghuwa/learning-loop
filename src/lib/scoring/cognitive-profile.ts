export function ema(oldScore: number, newDataPoint: number) {
  return Number((0.85 * oldScore + 0.15 * newDataPoint).toFixed(2));
}

const percentileTable = [
  { score: 3, percentile: 35 },
  { score: 4, percentile: 50 },
  { score: 5, percentile: 65 },
  { score: 6, percentile: 78 },
  { score: 7, percentile: 88 },
  { score: 8, percentile: 94 },
  { score: 9, percentile: 98 },
  { score: 10, percentile: 99.5 },
];

export function mapToPercentile(score: number) {
  const match = percentileTable.find((x) => score <= x.score);
  return match?.percentile ?? 99.7;
}
