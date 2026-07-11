import { describe, it, expect } from 'vitest'
import { parseSmt } from '@/pipeline/stages'

describe('parseSmt', () => {
  it('extracts a fenced ```smt block', () => {
    const out = 'reasoning\n```smt\n(declare-const a Int)\n(assert (= a 4))\n```\ndone'
    expect(parseSmt(out)).toBe('(declare-const a Int)\n(assert (= a 4))')
  })

  it('returns undefined when there is no smt block', () => {
    expect(parseSmt('just prose, maybe a ```python\nprint(1)\n``` block')).toBeUndefined()
  })
})
