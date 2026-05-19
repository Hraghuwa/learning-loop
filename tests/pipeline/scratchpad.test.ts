import { describe, it, expect } from 'vitest'
import { emptyScratchpad } from '@/pipeline/scratchpad'

describe('emptyScratchpad', () => {
  it('initializes with best-effort state and zero confidence', () => {
    const s = emptyScratchpad('2+2?', {
      domain: 'arithmetic', subDomain: 's', type: 't', difficulty: 1,
      ambiguity: [], isMCQ: false
    })
    expect(s.problem).toBe('2+2?')
    expect(s.verifyState).toBe('best-effort')
    expect(s.confidence).toBe(0)
    expect(s.stages).toEqual({})
  })
})
