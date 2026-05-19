import { describe, it, expect } from 'vitest'
import { FakeModel } from '@/model/fake'
import { verifyVerbal } from '@/verify/verbal'

describe('verifyVerbal', () => {
  it('maps entailment JSON to a confidence score', async () => {
    const m = new FakeModel([JSON.stringify({ entailment: 'entail', confidence: 88 })])
    const r = await verifyVerbal('answer', 'passage', m)
    expect(r.entailment).toBe('entail')
    expect(r.confidence).toBe(88)
  })
  it('returns low confidence on parse failure', async () => {
    const r = await verifyVerbal('a', 'p', new FakeModel(['garbage']))
    expect(r.entailment).toBe('neutral')
    expect(r.confidence).toBeLessThanOrEqual(20)
  })
})
