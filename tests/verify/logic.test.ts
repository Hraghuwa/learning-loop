import { describe, it, expect } from 'vitest'
import { verifyLogic } from '@/verify/logic'

const SMT = `
(declare-const a Int)
(declare-const b Int)
(assert (= (+ a b) 10))
(assert (= a 4))
(check-sat)
`

describe('verifyLogic', () => {
  it('solves a satisfiable constraint set', async () => {
    const r = await verifyLogic(SMT)
    expect(r.status).toBe('sat')
    expect(r.solution).toContain('b')
  })
  it('reports unsat', async () => {
    const r = await verifyLogic('(assert false)\n(check-sat)')
    expect(r.status).toBe('unsat')
  })

  it('reports multiple when more than one model satisfies', async () => {
    // a + b = 10 over the integers admits infinitely many models, so the
    // answer is NOT uniquely determined and must never be reported as a clean
    // `sat` (which the pipeline trusts as verified).
    const r = await verifyLogic('(declare-const a Int)\n(declare-const b Int)\n(assert (= (+ a b) 10))\n(check-sat)')
    expect(r.status).toBe('multiple')
  })

  it('keeps sat for a uniquely-determined model', async () => {
    // a + b = 10 AND a = 4 forces b = 6: exactly one model -> verifiable.
    const r = await verifyLogic('(declare-const a Int)\n(declare-const b Int)\n(assert (= (+ a b) 10))\n(assert (= a 4))\n(check-sat)')
    expect(r.status).toBe('sat')
    expect(r.solution).toContain('b')
  })
})
