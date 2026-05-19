import { describe, it, expect } from 'vitest'
import { majorityVote } from '@/consistency/vote'

describe('majorityVote', () => {
  it('picks the most common answer and reports agreement', () => {
    expect(majorityVote(['7', '7', '9', '7'])).toEqual({ winner: '7', agreement: 0.75 })
  })
  it('normalizes whitespace/case before counting', () => {
    expect(majorityVote([' Ten ', 'ten', 'TEN'])).toEqual({ winner: 'ten', agreement: 1 })
  })
  it('handles empty input', () => {
    expect(majorityVote([])).toEqual({ winner: '', agreement: 0 })
  })
})
