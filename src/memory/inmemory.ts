import { ModelPort } from '@/model/types'
import { MemoryPort, SolvedTrace } from './types'

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

export class InMemoryStore implements MemoryPort {
  private items: { vec: number[]; trace: SolvedTrace }[] = []
  constructor(private model: ModelPort) {}

  async write(trace: SolvedTrace): Promise<void> {
    this.items.push({ vec: await this.model.embed(trace.problem), trace })
  }

  async search(query: string, k: number): Promise<SolvedTrace[]> {
    if (this.items.length === 0) return []
    const q = await this.model.embed(query)
    return [...this.items]
      .map((it) => ({ s: cosine(q, it.vec), t: it.trace }))
      .sort((x, y) => y.s - x.s)
      .slice(0, k)
      .map((r) => r.t)
  }
}
