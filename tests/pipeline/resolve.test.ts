import { describe, it, expect } from 'vitest'
import { FakeModel } from '@/model/fake'
import { InMemoryStore } from '@/memory/inmemory'
import { solve } from '@/pipeline/pipeline'

// Arithmetic re-solve loop (design spec §6 step 7): when executed Python
// disagrees with the LLM's prose answer, run EXACTLY ONE re-solve — show the
// model both values, ask for fresh code, execute it, and reconcile. The
// verified value always comes from executed Python (honesty invariant).
//
// 1 classify + 9 stages = 10 scripted completions; a discrepancy adds 1 more.
function arithScript(executeOut: string, resolveOut?: string): string[] {
  const cls = JSON.stringify({
    domain: 'arithmetic', subDomain: 'percentages', type: 'simple',
    difficulty: 2, ambiguity: [], isMCQ: false,
  })
  const seq = [cls, 'ingested', 'formalized', 'strategy', executeOut,
    'constraints ok', 'adversarial ok', 'alt ok', 'not mcq',
    'final\nANSWER: 41']
  if (resolveOut !== undefined) seq.push(resolveOut)
  return seq
}

// execute-stage output whose code computes 42 but whose prose answer says 41.
const CONFLICTED = 'work\n```python\nprint(42)\n```\nANSWER: 41'

describe('solve (arithmetic re-solve on discrepancy)', () => {
  it('confirms: re-solve reproduces the verified value → discrepancy cleared, confidence 100', async () => {
    const model = new FakeModel(arithScript(
      CONFLICTED,
      'rechecked\n```python\nprint(42)\n```\nANSWER: 42'))
    const s = await solve('41 or 42?', { model, memory: new InMemoryStore(model), n: 1 })
    expect(s.verifyState).toBe('verified')
    expect(s.verifiedAnswer).toBe('42')
    expect(s.confidence).toBe(100)
    expect(s.discrepancy).toBeUndefined()
    expect(s.resolution).toMatch(/confirm/i)
    // the re-solve prompt must show the model both conflicting values
    const last = model.calls[model.calls.length - 1][0].content
    expect(last).toContain('42')
    expect(last).toContain('41')
  })

  it('corrects: re-solve agrees with the original LLM answer → adopt it at confidence 85', async () => {
    const model = new FakeModel(arithScript(
      CONFLICTED,
      'found my bug\n```python\nprint(41)\n```\nANSWER: 41'))
    const s = await solve('41 or 42?', { model, memory: new InMemoryStore(model), n: 1 })
    expect(s.verifyState).toBe('verified')
    expect(s.verifiedAnswer).toBe('41')
    expect(s.confidence).toBe(85)
    expect(s.resolution).toMatch(/correct/i)
  })

  it('unresolved: re-solve yields no usable code → keep first value, keep discrepancy, confidence 90', async () => {
    const model = new FakeModel(arithScript(CONFLICTED, 'I am not sure anymore.'))
    const s = await solve('41 or 42?', { model, memory: new InMemoryStore(model), n: 1 })
    expect(s.verifyState).toBe('verified')
    expect(s.verifiedAnswer).toBe('42')
    expect(s.confidence).toBe(90)
    expect(s.discrepancy).toMatch(/41/)
  })

  it('unresolved: re-solve computes a THIRD value → keep first value, confidence 90', async () => {
    const model = new FakeModel(arithScript(
      CONFLICTED,
      'hmm\n```python\nprint(99)\n```\nANSWER: 99'))
    const s = await solve('41 or 42?', { model, memory: new InMemoryStore(model), n: 1 })
    expect(s.verifyState).toBe('verified')
    expect(s.verifiedAnswer).toBe('42')
    expect(s.confidence).toBe(90)
    expect(s.discrepancy).toBeDefined()
  })

  it('no discrepancy → NO re-solve call (FakeModel would throw if one happened)', async () => {
    // prose answer and executed value agree; script has zero spare responses.
    const agreeing = 'work\n```python\nprint(41)\n```\nANSWER: 41'
    const model = new FakeModel(arithScript(agreeing))
    const s = await solve('what is 41?', { model, memory: new InMemoryStore(model), n: 1 })
    expect(s.verifiedAnswer).toBe('41')
    expect(s.confidence).toBe(100)
    expect(s.resolution).toBeUndefined()
    expect(model.calls.length).toBe(10)
  })
})
