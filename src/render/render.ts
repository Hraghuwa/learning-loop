import { Scratchpad } from '@/pipeline/scratchpad'

export function renderOutput(s: Scratchpad): string {
  const label = s.verifyState === 'verified'
    ? 'VERIFIED (machine-checked)'
    : `BEST-EFFORT — confidence ${s.confidence}/100`
  const disc = s.discrepancy ? `\n⚠ Discrepancy: ${s.discrepancy}` : ''
  const answer = s.verifiedAnswer ?? s.llmAnswer ?? '(none)'
  return [
    `【PROBLEM TYPE】 ${s.meta.domain} → ${s.meta.subDomain} → ${s.meta.type} → L${s.meta.difficulty}`,
    `【PARSING】 ${s.stages['ingestion'] ?? ''}`,
    `【STRATEGY】 ${s.stages['strategy'] ?? ''}`,
    `【SOLUTION】\n${s.stages['execute'] ?? ''}`,
    `【VERIFICATION】 [${label}] ${s.stages['altmethod'] ?? ''}${disc}`,
    `【ANSWER】 ✓ ${answer}`,
    `【INSIGHT】 ${s.stages['adversarial'] ?? ''}`,
    `【NEW Q】 ${s.newQuestion ?? '(generation deferred to sub-project 2)'}`
  ].join('\n\n')
}
