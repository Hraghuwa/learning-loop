import { ProblemMeta } from '@/classifier/types'

export type VerifyState = 'verified' | 'best-effort'

export interface Scratchpad {
  problem: string
  meta: ProblemMeta
  similar: string[]
  stages: Record<string, string>
  computation?: string
  constraints?: string
  llmAnswer?: string
  verifiedAnswer?: string
  verifyState: VerifyState
  confidence: number
  newQuestion?: string
  discrepancy?: string
}

export function emptyScratchpad(problem: string, meta: ProblemMeta): Scratchpad {
  return { problem, meta, similar: [], stages: {}, verifyState: 'best-effort', confidence: 0 }
}
