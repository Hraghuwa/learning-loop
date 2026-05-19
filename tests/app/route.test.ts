import { describe, it, expect, vi } from 'vitest'

vi.mock('@/model/anthropic', () => ({
  AnthropicModel: class {
    private q = [
      JSON.stringify({ domain: 'arithmetic', subDomain: 'tsd', type: 'trains',
        difficulty: 2, ambiguity: [], isMCQ: false }),
      'i', 'f', 's', 'work\n```python\nprint(120//2)\n```\nANSWER: 60',
      'c', 'a', 'alt\nANSWER: 60', 'o', 'final\nANSWER: 60'
    ]
    async complete() { return this.q.shift() ?? 'x' }
    async embed() { return [1, 0, 0, 0, 0, 0, 0, 0] }
  }
}))

import { POST } from '@/app/api/solve/route'

describe('POST /api/solve', () => {
  it('returns rendered output for a problem', async () => {
    const req = new Request('http://x/api/solve', {
      method: 'POST', body: JSON.stringify({ problem: 'A train runs 120km in 2h. Speed?' })
    })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.output).toContain('【ANSWER】')
    expect(body.output).toContain('60')
    expect(body.output).toContain('VERIFIED')
  })

  it('returns 400 when problem is missing', async () => {
    const res = await POST(new Request('http://x/api/solve', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(400)
  })
})
