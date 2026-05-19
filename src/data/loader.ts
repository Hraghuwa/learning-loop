import { readFileSync } from 'node:fs'
import { Domain } from '@/classifier/types'

export interface DatasetCase {
  id: string
  domain: Domain
  subDomain: string
  problem: string
  answer: string
  source: string
}

const DOMAINS = ['arithmetic', 'verbal', 'logic', 'di', 'visual']
const FIELDS = ['id', 'domain', 'subDomain', 'problem', 'answer', 'source'] as const

export function loadDataset(path: string): DatasetCase[] {
  const raw = readFileSync(path, 'utf8')
  const cases: DatasetCase[] = []
  raw.split('\n').forEach((line, idx) => {
    const trimmed = line.trim()
    if (!trimmed) return
    let o: Record<string, unknown>
    try {
      o = JSON.parse(trimmed)
    } catch {
      throw new Error(`dataset: invalid JSON on line ${idx + 1}`)
    }
    for (const f of FIELDS) {
      if (typeof o[f] !== 'string' || (o[f] as string).length === 0) {
        throw new Error(`dataset: line ${idx + 1} missing/invalid field "${f}"`)
      }
    }
    if (!DOMAINS.includes(o.domain as string)) {
      throw new Error(`dataset: line ${idx + 1} invalid domain "${String(o.domain)}"`)
    }
    cases.push(o as unknown as DatasetCase)
  })
  if (cases.length === 0) throw new Error('dataset: no cases found')
  return cases
}
