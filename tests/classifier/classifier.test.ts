import { describe, it, expect } from 'vitest'
import { FakeModel } from '@/model/fake'
import { classify } from '@/classifier/classifier'

const json = JSON.stringify({
  domain: 'arithmetic', subDomain: 'time-speed-distance', type: 'trains',
  difficulty: 3, ambiguity: [], isMCQ: true, options: ['10', '20']
})

describe('classify', () => {
  it('parses model JSON into ProblemMeta', async () => {
    const meta = await classify('A train...', new FakeModel([json]))
    expect(meta.domain).toBe('arithmetic')
    expect(meta.difficulty).toBe(3)
    expect(meta.isMCQ).toBe(true)
    expect(meta.options).toEqual(['10', '20'])
  })

  it('defaults to best-effort meta when JSON is unparseable', async () => {
    const meta = await classify('x', new FakeModel(['not json']))
    expect(meta.domain).toBe('verbal')
    expect(meta.ambiguity).toContain('classifier-parse-failed')
  })
})
