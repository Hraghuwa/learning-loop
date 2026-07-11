import { AnthropicModel } from '@/model/anthropic'
import { InMemoryStore } from '@/memory/inmemory'
import { solve } from '@/pipeline/pipeline'
import { renderOutput } from '@/render/render'
import { FixedWindowLimiter } from '@/lib/rate-limit'

const model = new AnthropicModel()
const memory = new InMemoryStore(model)

// Each solve fans out to ~10 model completions plus Python verifier
// subprocesses, so this endpoint is the most expensive thing this instance
// serves. 10/min per client is generous for a human, hostile to a loop.
const limiter = new FixedWindowLimiter({ limit: 10, windowMs: 60_000 })
const MAX_PROBLEM_CHARS = 4_000

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body),
    { status, headers: { 'content-type': 'application/json', ...headers } })
}

export async function POST(req: Request): Promise<Response> {
  const ip = (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim()
  const gate = limiter.allow(ip)
  if (!gate.ok) {
    return json(429, { error: 'rate limit exceeded' },
      { 'retry-after': String(gate.retryAfterSec ?? 60) })
  }

  let problem = ''
  try { problem = String((await req.json()).problem ?? '') } catch { /* invalid json */ }
  if (!problem.trim()) {
    return json(400, { error: 'problem is required' })
  }
  if (problem.length > MAX_PROBLEM_CHARS) {
    return json(400, { error: `problem exceeds ${MAX_PROBLEM_CHARS} characters` })
  }

  const s = await solve(problem, { model, memory, n: 1 })
  return json(200, { output: renderOutput(s), state: s.verifyState })
}
