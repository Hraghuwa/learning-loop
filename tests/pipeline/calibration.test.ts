import { describe, it, expect } from 'vitest'
import { FakeModel } from '@/model/fake'
import { InMemoryStore } from '@/memory/inmemory'
import { solve } from '@/pipeline/pipeline'

const cls = JSON.stringify({
  domain: 'di', subDomain: 's', type: 't',
  difficulty: 2, ambiguity: [], isMCQ: false,
})

function script(answer: string): string[] {
  const stages = Array(8).fill('step')
  return [cls, ...stages, `final\nANSWER: ${answer}`]
}

describe('self-consistency confidence calibration', () => {
  it('a single unverified sample must NOT report near-certain confidence', async () => {
    const model = new FakeModel(script('42'))
    const s = await solve('some DI problem', { model, memory: new InMemoryStore(model), n: 1 })
    expect(s.verifyState).toBe('best-effort')
    // n=1: the sample trivially agrees with itself — there is zero consistency
    // evidence. Confidence must be the no-evidence baseline, far below the
    // 100 that machine-verified answers earn.
    expect(s.confidence).toBe(50)
  })

  it('unanimous agreement across n=3 still earns high (but not verified-level) confidence', async () => {
    const seq = [cls]
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 8; j++) seq.push('step')
      seq.push('final\nANSWER: same')
    }
    // classify is consumed once; attempts 2..n reuse the meta.
    const model = new FakeModel(seq)
    const s = await solve('some DI problem', { model, memory: new InMemoryStore(model), n: 3 })
    expect(s.verifyState).toBe('best-effort')
    // Unanimity is strong evidence but not proof: capped at 95 so best-effort
    // can never display the same certainty as a machine-verified answer (100).
    expect(s.confidence).toBe(95)
  })
})
