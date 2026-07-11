import { describe, it, expect } from 'vitest'
import { FixedWindowLimiter } from '@/lib/rate-limit'

describe('FixedWindowLimiter', () => {
  it('allows up to the limit within a window, then refuses with retryAfter', () => {
    const now = 1_000_000
    const l = new FixedWindowLimiter({ limit: 3, windowMs: 60_000, now: () => now })

    expect(l.allow('a').ok).toBe(true)
    expect(l.allow('a').ok).toBe(true)
    expect(l.allow('a').ok).toBe(true)
    const refused = l.allow('a')
    expect(refused.ok).toBe(false)
    expect(refused.retryAfterSec).toBeGreaterThan(0)
    expect(refused.retryAfterSec).toBeLessThanOrEqual(60)
  })

  it('resets after the window elapses', () => {
    let now = 0
    const l = new FixedWindowLimiter({ limit: 1, windowMs: 60_000, now: () => now })
    expect(l.allow('a').ok).toBe(true)
    expect(l.allow('a').ok).toBe(false)
    now += 60_001
    expect(l.allow('a').ok).toBe(true)
  })

  it('tracks keys independently', () => {
    const now = 0
    const l = new FixedWindowLimiter({ limit: 1, windowMs: 60_000, now: () => now })
    expect(l.allow('a').ok).toBe(true)
    expect(l.allow('b').ok).toBe(true)
    expect(l.allow('a').ok).toBe(false)
  })

  it('evicts stale keys so memory stays bounded', () => {
    let now = 0
    const l = new FixedWindowLimiter({ limit: 1, windowMs: 1_000, now: () => now })
    for (let i = 0; i < 5_000; i++) l.allow(`k${i}`)
    now += 10_000
    l.allow('fresh') // any call past the window sweeps stale entries
    expect(l.size).toBeLessThanOrEqual(1)
  })
})
