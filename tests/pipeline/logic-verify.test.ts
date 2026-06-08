import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FakeModel } from '@/model/fake'
import { InMemoryStore } from '@/memory/inmemory'
import { solve } from '@/pipeline/pipeline'
import { verifyLogic } from '@/verify/logic'

// The pipeline wiring must be exercised deterministically, independent of the
// real z3 sidecar: we stub verifyLogic and assert how solve() reacts to each
// LogicResult status. (The real sidecar is covered in tests/verify/logic.test.ts.)
vi.mock('@/verify/logic', () => ({ verifyLogic: vi.fn() }))
const mockedVerifyLogic = vi.mocked(verifyLogic)

// 1 classify + 9 stages = 10 scripted completions. The `formal` stage emits the
// SMT program the pipeline should pick up and hand to the verifier.
function logicScript(smt: string, answer: string): string[] {
  const cls = JSON.stringify({
    domain: 'logic', subDomain: 'seating', type: 'arrangement',
    difficulty: 3, ambiguity: [], isMCQ: false
  })
  const stages = [
    'ingested',
    'formalized\n```smt\n' + smt + '\n```',
    'strategy chosen', 'executed', 'constraints ok', 'adversarial ok',
    'alt agrees', 'not mcq', 'final\nANSWER: ' + answer
  ]
  return [cls, ...stages]
}

const SMT = '(declare-const a Int)\n(assert (= a 4))\n(check-sat)'

describe('solve (logic verification)', () => {
  beforeEach(() => mockedVerifyLogic.mockReset())

  it('marks logic VERIFIED when the SMT model is unique', async () => {
    mockedVerifyLogic.mockResolvedValue({ status: 'sat', solution: '[a = 4, b = 6]' })
    const model = new FakeModel(logicScript(SMT, 'a=4'))
    const s = await solve('Two clerks sit ...', { model, memory: new InMemoryStore(model), n: 1 })

    expect(mockedVerifyLogic).toHaveBeenCalledOnce()
    expect(mockedVerifyLogic).toHaveBeenCalledWith(expect.stringContaining('declare-const a'))
    expect(s.verifyState).toBe('verified')
    expect(s.verifiedAnswer).toContain('a = 4')
    expect(s.confidence).toBe(100)
  })

  it('stays best-effort (never falsely verified) when multiple models satisfy', async () => {
    mockedVerifyLogic.mockResolvedValue({ status: 'multiple', solution: '[a = 4]' })
    const model = new FakeModel(logicScript(SMT, 'a=4'))
    const s = await solve('Ambiguous puzzle ...', { model, memory: new InMemoryStore(model), n: 1 })

    expect(s.verifyState).toBe('best-effort')
    expect(s.discrepancy).toMatch(/multiple/i)
  })

  it('stays best-effort when the constraints are unsat', async () => {
    mockedVerifyLogic.mockResolvedValue({ status: 'unsat' })
    const model = new FakeModel(logicScript(SMT, 'a=4'))
    const s = await solve('Contradictory puzzle ...', { model, memory: new InMemoryStore(model), n: 1 })

    expect(s.verifyState).toBe('best-effort')
    expect(s.discrepancy).toMatch(/unsat/i)
  })

  it('does not invoke the logic verifier when no SMT is produced', async () => {
    mockedVerifyLogic.mockResolvedValue({ status: 'sat', solution: '[a = 4]' })
    // No ```smt``` block in any stage -> nothing to verify.
    const cls = JSON.stringify({ domain: 'logic', subDomain: 'x', type: 'x',
      difficulty: 3, ambiguity: [], isMCQ: false })
    const model = new FakeModel([cls, 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'final\nANSWER: 7'])
    const s = await solve('No formalization here', { model, memory: new InMemoryStore(model), n: 1 })

    expect(mockedVerifyLogic).not.toHaveBeenCalled()
    expect(s.verifyState).toBe('best-effort')
  })
})
