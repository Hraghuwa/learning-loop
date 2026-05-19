import { describe, it, expect } from 'vitest'
import { buildStagePrompt, parseExecute, STAGE_NAMES } from '@/pipeline/stages'
import { emptyScratchpad } from '@/pipeline/scratchpad'

const s = emptyScratchpad('A train runs 120km in 2h. Speed?', {
  domain: 'arithmetic', subDomain: 'tsd', type: 'trains', difficulty: 2,
  ambiguity: [], isMCQ: false
})

describe('stages', () => {
  it('exposes the 9 stage names in order', () => {
    expect(STAGE_NAMES).toHaveLength(9)
    expect(STAGE_NAMES[0]).toBe('ingestion')
    expect(STAGE_NAMES[8]).toBe('articulation')
  })
  it('builds a prompt that includes the problem and prior stage text', () => {
    s.stages['ingestion'] = 'understood'
    const p = buildStagePrompt('strategy', s)
    expect(p).toContain('A train runs 120km')
    expect(p).toContain('understood')
  })
  it('parses fenced python out of an execute-stage response', () => {
    const r = parseExecute('Reasoning...\n```python\nprint(120/2)\n```\nANSWER: 60')
    expect(r.code).toBe('print(120/2)')
    expect(r.answer).toBe('60')
  })
  it('parses ANSWER line when no code block present', () => {
    const r = parseExecute('Some prose.\nANSWER: 42')
    expect(r.code).toBeUndefined()
    expect(r.answer).toBe('42')
  })
})
