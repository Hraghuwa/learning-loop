import { describe, it, expect } from 'vitest'
import { FakeModel } from '@/model/fake'
import { InMemoryStore } from '@/memory/inmemory'
import { solve } from '@/pipeline/pipeline'

// 1 classify + 9 stages + 1 verbal-entailment check = 11 scripted completions.
// verifyVerbal (src/verify/verbal.ts) issues the final model.complete with the
// entailment JSON, so we script that as the last response — no mocking needed.
function verbalScript(answer: string, entailmentJson: string): string[] {
  const cls = JSON.stringify({
    domain: 'verbal', subDomain: 'reading-comprehension', type: 'main-idea',
    difficulty: 3, ambiguity: [], isMCQ: true,
  })
  const stages = [
    'ingested', 'formalized', 'strategy', 'reasoned\nANSWER: ' + answer,
    'constraints ok', 'adversarial ok', 'alt agrees\nANSWER: ' + answer,
    'not mcq', 'final\nANSWER: ' + answer,
  ]
  return [cls, ...stages, entailmentJson]
}

describe('solve (verbal verification)', () => {
  it('raises confidence and stays best-effort when the answer is entailed', async () => {
    const model = new FakeModel(verbalScript('B', '{"entailment":"entail","confidence":80}'))
    const s = await solve('Passage… what is the main idea?',
      { model, memory: new InMemoryStore(model), n: 1 })
    // Honesty invariant: verbal is NEVER machine-verified (only Python/Z3 are).
    expect(s.verifyState).toBe('best-effort')
    expect(s.verifiedAnswer).toBe('b')
    expect(s.confidence).toBeGreaterThan(60)
    expect(s.discrepancy).toBeUndefined()
  })

  it('drops confidence and flags a discrepancy when the answer contradicts the source', async () => {
    const model = new FakeModel(verbalScript('B', '{"entailment":"contradict","confidence":90}'))
    const s = await solve('Passage…', { model, memory: new InMemoryStore(model), n: 1 })
    expect(s.verifyState).toBe('best-effort')
    expect(s.confidence).toBeLessThan(30)
    expect(s.discrepancy).toMatch(/contradict/i)
  })

  it('uses a neutral baseline when entailment is neutral', async () => {
    const model = new FakeModel(verbalScript('B', '{"entailment":"neutral","confidence":50}'))
    const s = await solve('Passage…', { model, memory: new InMemoryStore(model), n: 1 })
    expect(s.verifyState).toBe('best-effort')
    expect(s.verifiedAnswer).toBe('b')
    expect(s.confidence).toBe(35)
  })
})
