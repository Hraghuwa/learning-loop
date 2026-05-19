import { ModelPort } from '@/model/types'

export interface VerbalResult {
  entailment: 'entail' | 'neutral' | 'contradict'
  confidence: number
}

const PROMPT = (a: string, p: string) => `Is the ANSWER entailed by the SOURCE?
Reply ONLY JSON: {"entailment":"entail|neutral|contradict","confidence":0-100}
SOURCE:
${p}
ANSWER:
${a}`

export async function verifyVerbal(answer: string, source: string, model: ModelPort): Promise<VerbalResult> {
  const raw = await model.complete([{ role: 'user', content: PROMPT(answer, source) }], { json: true })
  try {
    const o = JSON.parse(raw)
    const e = ['entail', 'neutral', 'contradict'].includes(o.entailment) ? o.entailment : 'neutral'
    const c = Number(o.confidence)
    return { entailment: e, confidence: Number.isFinite(c) ? Math.max(0, Math.min(100, c)) : 10 }
  } catch {
    return { entailment: 'neutral', confidence: 10 }
  }
}
