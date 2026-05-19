import { ProblemMeta } from '@/classifier/types'

export interface SolvedTrace {
  problem: string
  meta: ProblemMeta
  answer: string
  output: string
}

export interface MemoryPort {
  search(query: string, k: number): Promise<SolvedTrace[]>
  write(trace: SolvedTrace): Promise<void>
}
