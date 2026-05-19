import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'

function call(input: object): any {
  const out = execFileSync('python3', ['src/verify/sidecar.py'], {
    input: JSON.stringify(input), timeout: 5000
  }).toString()
  return JSON.parse(out)
}

describe('sidecar arithmetic', () => {
  it('evaluates an exact expression', () => {
    expect(call({ op: 'arithmetic', code: 'print(2**10 + 24)' }))
      .toEqual({ ok: true, value: '1048' })
  })
  it('returns error for failing code, never throws', () => {
    const r = call({ op: 'arithmetic', code: 'print(1/0)' })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('ZeroDivisionError')
  })
  it('returns JSON (never a traceback) on malformed stdin', () => {
    const out = execFileSync('python3', ['src/verify/sidecar.py'], { input: 'not json at all' }).toString()
    const r = JSON.parse(out)
    expect(r.ok).toBe(false)
    expect(r.error).toContain('bad request')
  })
})
