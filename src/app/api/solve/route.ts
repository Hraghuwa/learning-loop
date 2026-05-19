import { AnthropicModel } from '@/model/anthropic'
import { InMemoryStore } from '@/memory/inmemory'
import { solve } from '@/pipeline/pipeline'
import { renderOutput } from '@/render/render'

const model = new AnthropicModel()
const memory = new InMemoryStore(model)

export async function POST(req: Request): Promise<Response> {
  let problem = ''
  try { problem = String((await req.json()).problem ?? '') } catch { /* invalid json */ }
  if (!problem.trim()) {
    return new Response(JSON.stringify({ error: 'problem is required' }),
      { status: 400, headers: { 'content-type': 'application/json' } })
  }
  const s = await solve(problem, { model, memory, n: 1 })
  return new Response(JSON.stringify({ output: renderOutput(s), state: s.verifyState }),
    { status: 200, headers: { 'content-type': 'application/json' } })
}
