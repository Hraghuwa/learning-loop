import { describe, it, expect } from 'vitest'
import { renderOutput } from '@/render/render'
import { emptyScratchpad } from '@/pipeline/scratchpad'

function base() {
  const s = emptyScratchpad('Q?', { domain: 'arithmetic', subDomain: 'tsd',
    type: 'trains', difficulty: 2, ambiguity: [], isMCQ: false })
  s.stages = { ingestion: 'i', formal: 'f', strategy: 'st', execute: 'e',
    constraint: 'c', adversarial: 'a', altmethod: 'm', options: 'o', articulation: 'final' }
  return s
}

describe('renderOutput', () => {
  it('renders all fixed sections', () => {
    const s = base(); s.verifyState = 'verified'; s.verifiedAnswer = '60'; s.confidence = 100
    const out = renderOutput(s)
    for (const tag of ['【PROBLEM TYPE】', '【PARSING】', '【STRATEGY】',
      '【SOLUTION】', '【VERIFICATION】', '【ANSWER】', '【INSIGHT】', '【NEW Q】']) {
      expect(out).toContain(tag)
    }
    expect(out).toContain('VERIFIED')
    expect(out).toContain('60')
  })

  it('labels verbal output as best-effort with confidence and never VERIFIED', () => {
    const s = base()
    s.meta.domain = 'verbal'
    s.verifyState = 'best-effort'; s.verifiedAnswer = 'B'; s.confidence = 72
    const out = renderOutput(s)
    expect(out).toContain('BEST-EFFORT')
    expect(out).toContain('72')
    expect(out).not.toContain('VERIFIED')
  })

  it('surfaces a discrepancy note when present', () => {
    const s = base(); s.verifyState = 'verified'; s.verifiedAnswer = '60'
    s.discrepancy = 'LLM answered "99" but verified value is "60"'
    expect(renderOutput(s)).toContain('99')
  })
})
