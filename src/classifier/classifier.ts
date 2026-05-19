import { ModelPort } from '@/model/types'
import { ProblemMeta, Domain } from './types'

const DOMAINS: Domain[] = ['arithmetic', 'verbal', 'logic', 'di', 'visual']

const PROMPT = (p: string) => `Classify this competitive-exam problem. Reply ONLY JSON:
{"domain":"arithmetic|verbal|logic|di|visual","subDomain":string,"type":string,"difficulty":1-5,"ambiguity":string[],"isMCQ":boolean,"options":string[]?}
Problem:
${p}`

export async function classify(text: string, model: ModelPort): Promise<ProblemMeta> {
  const raw = await model.complete([{ role: 'user', content: PROMPT(text) }], { json: true })
  try {
    const o = JSON.parse(raw)
    const domain: Domain = DOMAINS.includes(o.domain) ? o.domain : 'verbal'
    const d = Number(o.difficulty)
    return {
      domain,
      subDomain: String(o.subDomain ?? 'unknown'),
      type: String(o.type ?? 'unknown'),
      difficulty: (d >= 1 && d <= 5 ? d : 3) as ProblemMeta['difficulty'],
      ambiguity: Array.isArray(o.ambiguity) ? o.ambiguity.map(String) : [],
      isMCQ: Boolean(o.isMCQ),
      options: Array.isArray(o.options) ? o.options.map(String) : undefined
    }
  } catch {
    return { domain: 'verbal', subDomain: 'unknown', type: 'unknown', difficulty: 3,
      ambiguity: ['classifier-parse-failed'], isMCQ: false }
  }
}
