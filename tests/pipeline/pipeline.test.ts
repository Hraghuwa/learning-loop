import { describe, it, expect } from 'vitest'
import { FakeModel } from '@/model/fake'
import { InMemoryStore } from '@/memory/inmemory'
import { solve } from '@/pipeline/pipeline'

// 1 classify + 9 stages = 10 scripted completions.
function script(answer: string, code: string): string[] {
  const cls = JSON.stringify({ domain: 'arithmetic', subDomain: 'tsd', type: 'trains',
    difficulty: 2, ambiguity: [], isMCQ: false })
  const stages = [
    'ingested', 'formalized', 'strategy chosen',
    'work...\n```python\n' + code + '\n```\nANSWER: ' + answer,
    'constraints ok', 'adversarial ok', 'alt agrees\nANSWER: ' + answer,
    'not mcq', 'final\nANSWER: ' + answer
  ]
  return [cls, ...stages]
}

describe('solve', () => {
  it('marks arithmetic verified when LLM answer matches executed value', async () => {
    const model = new FakeModel(script('60', 'print(120//2)'))
    const mem = new InMemoryStore(model)
    const s = await solve('A train runs 120km in 2h. Speed?', { model, memory: mem, n: 1 })
    expect(s.verifyState).toBe('verified')
    expect(s.verifiedAnswer).toBe('60')
    expect(s.discrepancy).toBeUndefined()
  })

  it('flags a discrepancy and trusts the verifier when they disagree', async () => {
    // A discrepancy now triggers ONE re-solve call (tests/pipeline/resolve.test.ts
    // covers its outcomes); script an unusable response so it stays unresolved.
    const model = new FakeModel([...script('99', 'print(120//2)'), 'cannot decide'])
    const mem = new InMemoryStore(model)
    const s = await solve('A train runs 120km in 2h. Speed?', { model, memory: mem, n: 1 })
    expect(s.verifiedAnswer).toBe('60')
    expect(s.discrepancy).toContain('99')
    expect(s.verifyState).toBe('verified')
  })

  it('writes the solved trace to memory', async () => {
    const model = new FakeModel(script('60', 'print(120//2)'))
    const mem = new InMemoryStore(model)
    await solve('A train runs 120km in 2h. Speed?', { model, memory: mem, n: 1 })
    const found = await mem.search('train speed', 1)
    expect(found[0]?.answer).toBe('60')
  })
})
