import { describe, it, expect } from 'vitest'
import { FakeModel } from '@/model/fake'

describe('FakeModel', () => {
  it('returns scripted completions in order', async () => {
    const m = new FakeModel(['first', 'second'])
    expect(await m.complete([{ role: 'user', content: 'a' }])).toBe('first')
    expect(await m.complete([{ role: 'user', content: 'b' }])).toBe('second')
  })

  it('records calls', async () => {
    const m = new FakeModel(['x'])
    await m.complete([{ role: 'user', content: 'hello' }])
    expect(m.calls[0][0].content).toBe('hello')
  })

  it('embeds deterministically by length-seeded vector', async () => {
    const m = new FakeModel([])
    const v = await m.embed('abc')
    expect(v).toHaveLength(8)
    expect(await m.embed('abc')).toEqual(v)
  })
})
