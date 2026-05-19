import Anthropic from '@anthropic-ai/sdk'
import { ModelPort, Message, CompleteOpts } from './types'

// Minimal shape of the Anthropic client we depend on. Lets tests inject a
// fake without an API key (the real SDK satisfies this structurally).
export interface AnthropicLike {
  messages: { create: (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text?: string }> }> }
}

export class AnthropicModel implements ModelPort {
  private client: AnthropicLike

  constructor(client?: AnthropicLike) {
    this.client = client ?? (new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) as unknown as AnthropicLike)
  }

  async complete(messages: Message[], _opts?: CompleteOpts): Promise<string> {
    const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n')
    const msgs = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    // Opus 4.7: temperature/top_p/top_k are removed (400 if sent) — never
    // forward _opts.temperature. Adaptive thinking is the on-switch for
    // multi-step reasoning. The stable system prompt gets a cache breakpoint.
    const req: Record<string, unknown> = {
      model: 'claude-opus-4-7',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      messages: msgs
    }
    if (sys) req.system = [{ type: 'text', text: sys, cache_control: { type: 'ephemeral' } }]

    const r = await this.client.messages.create(req)
    // With adaptive thinking the first block may be a (display-omitted)
    // thinking block, so find the text block rather than indexing [0].
    const block = r.content.find((b) => b.type === 'text')
    return block?.text ?? ''
  }

  async embed(text: string): Promise<number[]> {
    // Deterministic placeholder embedding, position-weighted to match
    // FakeModel.embed so RAG ranking behaves identically across model
    // implementations. Swap for a real embedding provider in sub-project 3.
    const v = new Array(8).fill(0)
    for (let k = 0; k < text.length; k++) v[k % 8] += text.charCodeAt(k) * (k + 1)
    return v
  }
}
