import { pathToFileURL } from 'node:url'
import { FakeModel } from '../src/model/fake'
import { AnthropicModel } from '../src/model/anthropic'
import { InMemoryStore } from '../src/memory/inmemory'
import { solve } from '../src/pipeline/pipeline'
import { renderOutput } from '../src/render/render'

const DEMO_PROBLEM = 'A train runs 120 km in 2 hours. What is its speed in km/h?'

// Deterministic, no-API-key, no-cost demo. Shows the exact 【…】 output shape
// and the machine-VERIFIED arithmetic path via a scripted FakeModel.
export async function runDemo(): Promise<string> {
  const model = new FakeModel([
    JSON.stringify({ domain: 'arithmetic', subDomain: 'time-speed-distance',
      type: 'trains', difficulty: 2, ambiguity: [], isMCQ: false }),
    'Given: 120 km in 2 h. Asked: speed. No traps.',
    'Let s = speed. s = distance / time = 120 / 2.',
    'Strategy A: direct formula s = d/t. Strategy B: unitary. Pick A (fewest steps).',
    'Compute the speed.\n```python\nprint(120 // 2)\n```\nANSWER: 60',
    'Check: 60 km/h x 2 h = 120 km. Consistent.',
    'Counter-solver: a common trap is dividing time by distance. Avoided.',
    'Alternative (unitary): 120 km / 2 = 60 km per hour.\nANSWER: 60',
    'Not an MCQ.',
    'Speed is 60 km/h. Key idea: speed = distance / time.\nANSWER: 60'
  ])
  const s = await solve(DEMO_PROBLEM, { model, memory: new InMemoryStore(model), n: 1 })
  return renderOutput(s)
}

// Real end-to-end solve. Requires ANTHROPIC_API_KEY (costs money per run).
export async function runReal(problem: string): Promise<string> {
  const model = new AnthropicModel()
  const s = await solve(problem, { model, memory: new InMemoryStore(model), n: 1 })
  return renderOutput(s)
}

async function main(): Promise<void> {
  const problem = process.argv.slice(2).join(' ').trim()
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY)

  if (!problem) {
    process.stdout.write(
      'No problem given — running the built-in deterministic demo (no API key, no cost).\n\n'
    )
    process.stdout.write((await runDemo()) + '\n')
    return
  }
  if (!hasKey) {
    process.stderr.write(
      'ANTHROPIC_API_KEY is not set. A real solve calls Claude and costs money.\n' +
      'See the no-cost demo with:  npm run solve\n' +
      'Then for a real run:  export ANTHROPIC_API_KEY=sk-... && npm run solve -- "<your problem>"\n'
    )
    process.exitCode = 1
    return
  }
  process.stdout.write((await runReal(problem)) + '\n')
}

// Run only when executed directly (not when imported by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
