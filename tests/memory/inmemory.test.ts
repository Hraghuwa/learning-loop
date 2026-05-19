import { describe, it, expect } from 'vitest'
import { FakeModel } from '@/model/fake'
import { InMemoryStore } from '@/memory/inmemory'
import { ProblemMeta } from '@/classifier/types'

const meta: ProblemMeta = { domain: 'arithmetic', subDomain: 's', type: 't',
  difficulty: 1, ambiguity: [], isMCQ: false }

describe('InMemoryStore', () => {
  it('returns nothing before any writes', async () => {
    const s = new InMemoryStore(new FakeModel([]))
    expect(await s.search('train speed', 3)).toEqual([])
  })
  it('retrieves the nearest written trace', async () => {
    const s = new InMemoryStore(new FakeModel([]))
    await s.write({ problem: 'train speed problem', meta, answer: '60', output: 'o1' })
    await s.write({ problem: 'totally unrelated poem', meta, answer: 'x', output: 'o2' })
    const res = await s.search('a problem about train speed', 1)
    expect(res).toHaveLength(1)
    expect(res[0].answer).toBe('60')
  })
})
