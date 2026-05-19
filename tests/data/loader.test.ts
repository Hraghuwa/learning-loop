import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadDataset } from '@/data/loader'

const REAL = 'datasets/cat-pyq.jsonl'

describe('loadDataset', () => {
  it('loads the real CAT dataset with >= 20 valid, unique cases', () => {
    const cases = loadDataset(REAL)
    expect(cases.length).toBeGreaterThanOrEqual(20)
    const ids = new Set(cases.map((c) => c.id))
    expect(ids.size).toBe(cases.length) // ids unique
    for (const c of cases) {
      expect(['arithmetic', 'verbal', 'logic', 'di', 'visual']).toContain(c.domain)
      expect(c.problem.length).toBeGreaterThan(0)
      expect(c.answer.length).toBeGreaterThan(0)
    }
    expect(cases.filter((c) => c.domain === 'arithmetic').length).toBeGreaterThanOrEqual(10)
  })

  it('skips blank lines', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ds-'))
    const p = join(dir, 'd.jsonl')
    writeFileSync(p, '\n{"id":"x","domain":"arithmetic","subDomain":"s","problem":"2+2?","answer":"4","source":"t"}\n\n')
    expect(loadDataset(p)).toHaveLength(1)
  })

  it('throws a line-numbered error on invalid JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ds-'))
    const p = join(dir, 'bad.jsonl')
    writeFileSync(p, '{"id":"ok","domain":"arithmetic","subDomain":"s","problem":"p","answer":"a","source":"t"}\nNOT JSON')
    expect(() => loadDataset(p)).toThrow(/line 2/)
  })

  it('throws on an invalid domain value', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ds-'))
    const p = join(dir, 'dom.jsonl')
    writeFileSync(p, '{"id":"x","domain":"chemistry","subDomain":"s","problem":"p","answer":"a","source":"t"}')
    expect(() => loadDataset(p)).toThrow(/invalid domain/)
  })
})
