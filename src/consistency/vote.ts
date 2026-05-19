export function majorityVote(answers: string[]): { winner: string; agreement: number } {
  if (answers.length === 0) return { winner: '', agreement: 0 }
  const norm = (s: string) => s.trim().toLowerCase()
  const counts = new Map<string, number>()
  for (const a of answers) counts.set(norm(a), (counts.get(norm(a)) ?? 0) + 1)
  let winner = ''
  let best = 0
  for (const [k, v] of counts) if (v > best) { best = v; winner = k }
  return { winner, agreement: best / answers.length }
}
