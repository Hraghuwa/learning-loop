import { describe, it, expect } from 'vitest'
import { ModelPort, Message } from '@/model/types'
import { InMemoryStore } from '@/memory/inmemory'
import { solve } from '@/pipeline/pipeline'

// Model that answers from a queue AND records every prompt it receives, so we
// can assert what actually reaches the stage prompts.
class CaptureModel implements ModelPort {
  prompts: string[] = []
  private q: string[]
  constructor(answers: string[]) {
    this.q = answers
  }
  async complete(m: Message[]): Promise<string> {
    this.prompts.push(m[m.length - 1].content)
    return this.q.shift() ?? 'step'
  }
  async embed(): Promise<number[]> {
    // Constant vector: every text is maximally similar, so search always hits.
    return [1, 0, 0, 0, 0, 0, 0, 0]
  }
}

const cls = JSON.stringify({
  domain: 'algebra', subDomain: 's', type: 't',
  difficulty: 2, ambiguity: [], isMCQ: false,
})

function script(): string[] {
  const stages = Array(8).fill('step')
  return [cls, ...stages, 'final\nANSWER: 42']
}

describe('retrieval-augmented exemplars', () => {
  it('injects the stored reasoning trace (not just Q/A) into stage prompts', async () => {
    const model = new CaptureModel(script())
    const memory = new InMemoryStore(model)
    await memory.write({
      problem: 'A train covers 120 km in 2 hours. Find its speed.',
      meta: JSON.parse(cls),
      answer: '60 km/h',
      output: 'Speed = distance/time = 120/2 = 60. Key insight: uniform motion.\nANSWER: 60 km/h',
    })

    await solve('A car covers 200 km in 4 hours. Find its speed.', { model, memory, n: 1 })

    const stagePrompt = model.prompts.find((p) => p.includes('Analogous solved problems'))
    expect(stagePrompt).toBeDefined()
    // The exemplar must carry the reasoning, not only the final answer.
    expect(stagePrompt).toContain('Reasoning:')
    expect(stagePrompt).toContain('uniform motion')
    expect(stagePrompt).toContain('A: 60 km/h')
  })

  it('truncates very long reasoning traces so prompts stay bounded', async () => {
    const model = new CaptureModel(script())
    const memory = new InMemoryStore(model)
    await memory.write({
      problem: 'Some earlier problem',
      meta: JSON.parse(cls),
      answer: '7',
      output: 'x'.repeat(5000),
    })

    await solve('Another problem entirely', { model, memory, n: 1 })

    const stagePrompt = model.prompts.find((p) => p.includes('Analogous solved problems'))
    expect(stagePrompt).toBeDefined()
    // 5000-char trace must not be embedded whole (cap is 400 chars + ellipsis).
    expect(stagePrompt!.length).toBeLessThan(3000)
    expect(stagePrompt).toContain('…')
  })

  it('omits the Reasoning line when a trace has no output', async () => {
    const model = new CaptureModel(script())
    const memory = new InMemoryStore(model)
    await memory.write({
      problem: 'Old problem', meta: JSON.parse(cls), answer: '9', output: '',
    })

    await solve('New problem', { model, memory, n: 1 })

    const stagePrompt = model.prompts.find((p) => p.includes('Analogous solved problems'))
    expect(stagePrompt).toBeDefined()
    expect(stagePrompt).not.toContain('Reasoning:')
    expect(stagePrompt).toContain('A: 9')
  })
})
