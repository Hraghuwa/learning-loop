import { describe, it, expect } from 'vitest'
import { loadDataset, DatasetCase } from '@/data/loader'
import { FakeModel } from '@/model/fake'
import { InMemoryStore } from '@/memory/inmemory'
import { solve } from '@/pipeline/pipeline'

const cases = loadDataset('datasets/cat-pyq.jsonl')
const norm = (s: string) => s.trim().toLowerCase()

// Deterministic harness: feed FakeModel the correct Program-of-Thought per
// arithmetic case so the VERIFIED pipeline (classify -> stages -> Python
// execution -> reconciliation -> render) is exercised end-to-end over the
// whole real dataset. This proves the machinery, NOT that a model can derive
// the answer — that is the job of the key-gated real-model block below.
// Logic cases with a known SMT-LIB formalization whose constraint set admits a
// UNIQUE model — these exercise the real Z3 verified path end-to-end (the
// sidecar solves, then re-solves with the model blocked to prove uniqueness).
const SMT_FOR: Record<string, string> = {
  // L4: series 2,6,12,20,30 is n(n+1); the next term is 6·7.
  L4: '(declare-const next Int)\n(assert (= next (* 6 7)))',
}

function scriptFor(c: DatasetCase): string[] {
  const cls = JSON.stringify({
    domain: c.domain, subDomain: c.subDomain, type: c.subDomain,
    difficulty: 3, ambiguity: [], isMCQ: false
  })
  const smt = c.domain === 'logic' ? SMT_FOR[c.id] : undefined
  const exec = c.domain === 'arithmetic'
    ? `work\n\`\`\`python\nprint(${c.answer})\n\`\`\`\nANSWER: ${c.answer}`
    : smt
    ? `formalized\n\`\`\`smt\n${smt}\n\`\`\`\nANSWER: ${c.answer}`
    : `reasoned\nANSWER: ${c.answer}`
  const seq = [cls, 'ingest', 'formal', 'strategy', exec,
    'constraint', 'adversarial', `alt\nANSWER: ${c.answer}`, 'options',
    `final\nANSWER: ${c.answer}`]
  // The verbal branch makes one extra model call (entailment check); script a
  // neutral result so it stays best-effort and never falsely verified.
  if (c.domain === 'verbal') seq.push('{"entailment":"neutral","confidence":50}')
  return seq
}

describe('accuracy harness (deterministic machinery over the full dataset)', () => {
  it('the golden dataset has not silently shrunk', () => {
    // Every case in cat-pyq.jsonl is individually asserted below, so the gate
    // weakens invisibly if rows are dropped. Pin the per-domain floor: growing
    // the dataset is free; shrinking it must be a deliberate, reviewed edit.
    const byDomain: Record<string, number> = {}
    for (const c of cases) byDomain[c.domain] = (byDomain[c.domain] ?? 0) + 1
    expect(cases.length).toBeGreaterThanOrEqual(27)
    expect(byDomain['arithmetic']).toBeGreaterThanOrEqual(15)
    expect(byDomain['logic']).toBeGreaterThanOrEqual(8)
    expect(byDomain['verbal']).toBeGreaterThanOrEqual(4)
  })

  it('every arithmetic case is machine-VERIFIED and correct; verbal/logic is best-effort and never falsely verified', async () => {
    const score: Record<string, { total: number; correct: number; verified: number }> = {}
    for (const c of cases) {
      const model = new FakeModel(scriptFor(c))
      const s = await solve(c.problem, { model, memory: new InMemoryStore(model), n: 1 })
      const bucket = (score[c.domain] ??= { total: 0, correct: 0, verified: 0 })
      bucket.total++
      // SMT-verified answers are Z3 model strings ("[next = 42]"); correctness
      // there is containment of the expected value, not string equality.
      const correct = c.domain === 'logic' && SMT_FOR[c.id]
        ? norm(s.verifiedAnswer ?? '').includes(norm(c.answer))
        : norm(s.verifiedAnswer ?? '') === norm(c.answer)
      if (correct) bucket.correct++
      if (s.verifyState === 'verified') bucket.verified++

      if (c.domain === 'arithmetic') {
        expect(s.verifyState).toBe('verified')
        expect(norm(s.verifiedAnswer ?? '')).toBe(norm(c.answer))
      } else if (c.domain === 'logic' && SMT_FOR[c.id]) {
        // Z3-verified path: the unique satisfying model IS the verified answer
        // (e.g. "[next = 42]"), which must contain the expected value.
        expect(s.verifyState).toBe('verified')
        expect(norm(s.verifiedAnswer ?? '')).toContain(norm(c.answer))
        expect(s.discrepancy).toBeUndefined()
      } else {
        // honesty invariant: without executed Python or a uniquely-satisfying
        // SMT model, a case is NEVER machine-verified
        expect(s.verifyState).toBe('best-effort')
        expect(norm(s.verifiedAnswer ?? '')).toBe(norm(c.answer))
      }
    }
    console.log('\nDeterministic strike-rate by domain:',
      JSON.stringify(score, null, 2))

    const arith = score['arithmetic']
    expect(arith.correct).toBe(arith.total)
    expect(arith.verified).toBe(arith.total) // 100% machine-verified
    // Logic: exactly the SMT-formalized cases are Z3-verified — no more (no
    // false claims) and no fewer (the Z3 path is actually exercised).
    const smtCount = cases.filter((c) => c.domain === 'logic' && SMT_FOR[c.id]).length
    expect(smtCount).toBeGreaterThanOrEqual(1)
    expect(score['logic'].verified).toBe(smtCount)
    // Verbal can never be machine-verified (entailment is a judgement).
    expect(score['verbal'].verified).toBe(0)
    // Generous timeout: this harness spawns a fresh python3 sidecar per
    // arithmetic case (~20 cold subprocess starts), which is legitimately slow
    // on shared CI runners — the default 5s is too tight.
  }, 30_000)
})

// Real-model accuracy: only runs when ANTHROPIC_API_KEY is set (costs money).
// Skipped in CI. Reports a strike-rate scorecard; does not hard-fail on model
// accuracy (that varies) — it asserts only that the run produced results.
describe.skipIf(!process.env.ANTHROPIC_API_KEY)('real-model accuracy (gated)', () => {
  it('scores Claude over the dataset and prints a scorecard', async () => {
    const { AnthropicModel } = await import('@/model/anthropic')
    const model = new AnthropicModel()
    const memory = new InMemoryStore(model)
    const score: Record<string, { total: number; correct: number }> = {}
    for (const c of cases) {
      const s = await solve(c.problem, { model, memory, n: 1 })
      const b = (score[c.domain] ??= { total: 0, correct: 0 })
      b.total++
      if (norm(s.verifiedAnswer ?? '') === norm(c.answer)) b.correct++
    }
    console.log('\nReal-model strike-rate by domain:', JSON.stringify(score, null, 2))
    const total = Object.values(score).reduce((n, b) => n + b.total, 0)
    expect(total).toBe(cases.length)
  }, 600_000)
})
