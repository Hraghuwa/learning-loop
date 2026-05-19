import { describe, it, expect } from 'vitest'
import { runDemo } from '../../scripts/run'

describe('runDemo (no API key, no cost)', () => {
  it('produces the full structured output with a VERIFIED arithmetic answer', async () => {
    const out = await runDemo()
    for (const tag of ['【PROBLEM TYPE】', '【PARSING】', '【STRATEGY】',
      '【SOLUTION】', '【VERIFICATION】', '【ANSWER】', '【INSIGHT】', '【NEW Q】']) {
      expect(out).toContain(tag)
    }
    expect(out).toContain('VERIFIED')
    expect(out).toContain('60')
  })
})
