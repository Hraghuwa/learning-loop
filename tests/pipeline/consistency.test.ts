import { describe, it, expect } from 'vitest'
import { ModelPort, Message } from '@/model/types'
import { InMemoryStore } from '@/memory/inmemory'
import { solve } from '@/pipeline/pipeline'

// Model that returns a fixed classify, then a per-call answer queue for stages.
class ScriptModel implements ModelPort {
  private q: string[]
  constructor(answers: string[]) {
    // 'di' (data-interpretation): a non-verified domain that goes through the
    // generic self-consistency branch. (Not 'verbal' — verbal now derives its
    // confidence from the entailment check, which is exercised separately.)
    const cls = JSON.stringify({ domain: 'di', subDomain: 's', type: 't',
      difficulty: 2, ambiguity: [], isMCQ: false })
    // classify() consumes `cls` exactly ONCE; then each attempt = 9 stage
    // calls (8 'step' + 1 'final\nANSWER: <a>'), so attempts stay aligned.
    this.q = [cls]
    for (const a of answers) {
      for (let i = 0; i < 8; i++) this.q.push('step')
      this.q.push('final\nANSWER: ' + a)
    }
  }
  async complete(_m: Message[]): Promise<string> {
    return this.q.shift() ?? 'step'
  }
  async embed(): Promise<number[]> { return [1, 0, 0, 0, 0, 0, 0, 0] }
}

describe('self-consistency', () => {
  it('uses majority answer across n attempts for non-verified domains', async () => {
    const model = new ScriptModel(['blue', 'blue', 'red'])
    const s = await solve('what color?', { model, memory: new InMemoryStore(model), n: 3 })
    expect(s.verifiedAnswer).toBe('blue')
    // agreement 2/3 → round(60 + 40*0.667) = 87. Without the n-loop,
    // answers=['blue'] → agreement 1 → confidence 100 ≠ 87 (genuine guard).
    expect(s.confidence).toBe(87)
  })
})
