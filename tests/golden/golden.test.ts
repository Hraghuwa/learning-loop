import { describe, it, expect } from 'vitest'
import cases from './cases.json'
import { FakeModel } from '@/model/fake'
import { InMemoryStore } from '@/memory/inmemory'
import { solve } from '@/pipeline/pipeline'

// Drives the pipeline with a model that emits correct PoT code per case,
// proving the verified path yields the known answer end-to-end.
function modelFor(expected: string, code: string) {
  return new FakeModel([
    JSON.stringify({ domain: 'arithmetic', subDomain: 's', type: 't',
      difficulty: 2, ambiguity: [], isMCQ: false }),
    'i', 'f', 's',
    'work\n```python\n' + code + '\n```\nANSWER: ' + expected,
    'c', 'a', 'alt\nANSWER: ' + expected, 'o', 'final\nANSWER: ' + expected
  ])
}

describe('golden set (verified path)', () => {
  it('case 0: train speed', async () => {
    const m = modelFor(cases[0].expected, 'print(360//4)')
    const s = await solve(cases[0].problem, { model: m, memory: new InMemoryStore(m), n: 1 })
    expect(s.verifyState).toBe('verified')
    expect(s.verifiedAnswer).toBe('90')
  })
  it('case 1: men-days', async () => {
    const m = modelFor(cases[1].expected, 'print(8*10//16)')
    const s = await solve(cases[1].problem, { model: m, memory: new InMemoryStore(m), n: 1 })
    expect(s.verifyState).toBe('verified')
    expect(s.verifiedAnswer).toBe('5')
  })
})
