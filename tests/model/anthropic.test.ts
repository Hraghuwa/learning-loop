import { describe, it, expect } from 'vitest'
import { AnthropicModel } from '@/model/anthropic'

// Verifies the live request shape WITHOUT calling the real API, by injecting
// a fake Anthropic-like client. Opus 4.7 rejects sampling params with a 400,
// so complete() must NOT forward temperature/top_p/top_k.
describe('AnthropicModel.complete (Opus 4.7 request shape)', () => {
  it('omits sampling params, uses adaptive thinking, extracts the text block', async () => {
    let captured: any
    const fake = {
      messages: {
        create: async (a: any) => {
          captured = a
          return { content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'hello' }] }
        }
      }
    }
    const m = new AnthropicModel(fake)
    const out = await m.complete(
      [{ role: 'system', content: 'sys' }, { role: 'user', content: 'q' }],
      { temperature: 0.7 }
    )
    expect(out).toBe('hello')
    expect(captured.model).toBe('claude-opus-4-7')
    expect('temperature' in captured).toBe(false)
    expect('top_p' in captured).toBe(false)
    expect('top_k' in captured).toBe(false)
    expect(captured.thinking).toEqual({ type: 'adaptive' })
    expect(captured.messages).toEqual([{ role: 'user', content: 'q' }])
    expect(captured.system[0].cache_control).toEqual({ type: 'ephemeral' })
  })

  it('returns empty string when the response has no text block', async () => {
    const fake = { messages: { create: async () => ({ content: [{ type: 'thinking', thinking: '' }] }) } }
    const m = new AnthropicModel(fake)
    expect(await m.complete([{ role: 'user', content: 'q' }])).toBe('')
  })

  it('omits the system field entirely when there is no system message', async () => {
    let captured: any
    const fake = { messages: { create: async (a: any) => { captured = a; return { content: [{ type: 'text', text: 'x' }] } } } }
    await new AnthropicModel(fake).complete([{ role: 'user', content: 'q' }])
    expect('system' in captured).toBe(false)
  })
})
