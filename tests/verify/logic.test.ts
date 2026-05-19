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
})
