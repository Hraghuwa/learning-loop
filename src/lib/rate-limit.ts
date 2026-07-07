// Minimal fixed-window rate limiter for single-instance serving (this app's
// local-first deployment). No external store: counts live in module memory,
// which is exactly the blast radius we're protecting (each /api/solve call
// fans out to ~10 model completions and Python subprocesses on THIS instance).

export interface LimiterOptions {
  limit: number
  windowMs: number
  now?: () => number // injectable clock for tests
}

export interface AllowResult {
  ok: boolean
  retryAfterSec?: number
}

export class FixedWindowLimiter {
  private counts = new Map<string, { windowStart: number; n: number }>()
  private readonly limit: number
  private readonly windowMs: number
  private readonly now: () => number

  constructor(opts: LimiterOptions) {
    this.limit = opts.limit
    this.windowMs = opts.windowMs
    this.now = opts.now ?? Date.now
  }

  get size(): number {
    return this.counts.size
  }

  allow(key: string): AllowResult {
    const t = this.now()
    const entry = this.counts.get(key)

    if (!entry || t - entry.windowStart >= this.windowMs) {
      // New window for this key; opportunistically sweep stale entries so the
      // map can't grow unboundedly under many distinct keys.
      if (this.counts.size > 1_000) {
        for (const [k, e] of this.counts) {
          if (t - e.windowStart >= this.windowMs) this.counts.delete(k)
        }
      }
      this.counts.set(key, { windowStart: t, n: 1 })
      return { ok: true }
    }

    if (entry.n < this.limit) {
      entry.n++
      return { ok: true }
    }

    const retryAfterSec = Math.max(1, Math.ceil((entry.windowStart + this.windowMs - t) / 1000))
    return { ok: false, retryAfterSec }
  }
}
