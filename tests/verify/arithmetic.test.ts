import { describe, it, expect } from 'vitest'
import { verifyArithmetic } from '@/verify/arithmetic'

describe('verifyArithmetic', () => {
  it('returns the executed value', async () => {
    const r = await verifyArithmetic('print(15 * 4 - 3)')
    expect(r).toEqual({ ok: true, value: '57' })
  })
  it('surfaces execution errors as ok:false', async () => {
    const r = await verifyArithmetic('print(undefined_var)')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('NameError')
  })
})
