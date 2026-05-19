# APEX-REASON Core Solver v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v1 Core Solver: a problem in → 9-stage LLM pipeline → structured output whose arithmetic/logic answers are machine-verified (Python+SymPy / Z3), with self-consistency, RAG memory, and a minimal Next.js surface.

**Architecture:** A single `ModelPort` LLM interface drives a deterministic `pipeline` through 9 stages, holding a typed `Scratchpad`. Quantitative answers are produced by Program-of-Thought (model writes Python, a sandboxed sidecar executes it); logic puzzles are independently solved with Z3. A `FakeModel` makes the whole pipeline testable with zero API calls.

**Tech Stack:** TypeScript, Node 20+, Next.js (App Router), Vitest, Python 3 sidecar (`sympy`, `z3-solver`), `@anthropic-ai/sdk`.

---

## File Structure

```
package.json, tsconfig.json, vitest.config.ts
src/
  model/types.ts        ModelPort, Message, CompleteOpts
  model/fake.ts         FakeModel (scripted responses)
  model/anthropic.ts    AnthropicModel (real, thin)
  classifier/types.ts   ProblemMeta, Domain
  classifier/classifier.ts
  pipeline/scratchpad.ts Scratchpad + result types
  pipeline/stages.ts     per-stage prompt builders + parsers
  pipeline/pipeline.ts   solve() orchestration + reconciliation
  verify/sidecar.py      JSON-protocol Python: arithmetic (sympy) + logic (z3)
  verify/arithmetic.ts   calls sidecar op=arithmetic
  verify/logic.ts        calls sidecar op=logic
  verify/verbal.ts       NLI-as-LLM entailment → confidence
  consistency/vote.ts    majority vote over N answers
  memory/types.ts        MemoryPort, SolvedTrace
  memory/inmemory.ts     in-memory cosine store
  render/render.ts       Scratchpad → fixed 【…】 format
  app/api/solve/route.ts Next.js POST endpoint
  app/page.tsx           minimal UI
tests/  mirrors src/
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `tests/smoke.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
describe('smoke', () => {
  it('runs', () => { expect(1 + 1).toBe(2) })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/smoke.test.ts`
Expected: FAIL — `vitest` not installed / command not found.

- [ ] **Step 3: Create config files**

`package.json`:
```json
{
  "name": "apex-reason",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "dev": "next dev"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.40.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "@types/node": "^22.0.0"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "jsx": "preserve",
    "types": ["node", "vitest/globals"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "tests"]
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: { globals: true, environment: 'node' },
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } }
})
```

- [ ] **Step 4: Install and run test to verify it passes**

Run: `npm install && npx vitest run tests/smoke.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts tests/smoke.test.ts package-lock.json
git commit -m "chore: project scaffold with vitest"
```

---

### Task 2: Model port + FakeModel

**Files:**
- Create: `src/model/types.ts`, `src/model/fake.ts`, `tests/model/fake.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/model/fake.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { FakeModel } from '@/model/fake'

describe('FakeModel', () => {
  it('returns scripted completions in order', async () => {
    const m = new FakeModel(['first', 'second'])
    expect(await m.complete([{ role: 'user', content: 'a' }])).toBe('first')
    expect(await m.complete([{ role: 'user', content: 'b' }])).toBe('second')
  })

  it('records calls', async () => {
    const m = new FakeModel(['x'])
    await m.complete([{ role: 'user', content: 'hello' }])
    expect(m.calls[0][0].content).toBe('hello')
  })

  it('embeds deterministically by length-seeded vector', async () => {
    const m = new FakeModel([])
    const v = await m.embed('abc')
    expect(v).toHaveLength(8)
    expect(await m.embed('abc')).toEqual(v)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/model/fake.test.ts`
Expected: FAIL — cannot find module `@/model/fake`.

- [ ] **Step 3: Write minimal implementation**

`src/model/types.ts`:
```ts
export interface Message { role: 'system' | 'user' | 'assistant'; content: string }
export interface CompleteOpts { temperature?: number; json?: boolean }

export interface ModelPort {
  complete(messages: Message[], opts?: CompleteOpts): Promise<string>
  embed(text: string): Promise<number[]>
}
```

`src/model/fake.ts`:
```ts
import { ModelPort, Message, CompleteOpts } from './types'

export class FakeModel implements ModelPort {
  calls: Message[][] = []
  private i = 0
  constructor(private scripted: string[]) {}

  async complete(messages: Message[], _opts?: CompleteOpts): Promise<string> {
    this.calls.push(messages)
    if (this.i >= this.scripted.length) throw new Error('FakeModel: no scripted response left')
    return this.scripted[this.i++]
  }

  async embed(text: string): Promise<number[]> {
    const v = new Array(8).fill(0)
    for (let k = 0; k < text.length; k++) v[k % 8] += text.charCodeAt(k)
    return v
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/model/fake.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/model/types.ts src/model/fake.ts tests/model/fake.test.ts
git commit -m "feat: ModelPort interface and FakeModel test double"
```

---

### Task 3: ProblemMeta types + classifier

**Files:**
- Create: `src/classifier/types.ts`, `src/classifier/classifier.ts`, `tests/classifier/classifier.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/classifier/classifier.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { FakeModel } from '@/model/fake'
import { classify } from '@/classifier/classifier'

const json = JSON.stringify({
  domain: 'arithmetic', subDomain: 'time-speed-distance', type: 'trains',
  difficulty: 3, ambiguity: [], isMCQ: true, options: ['10', '20']
})

describe('classify', () => {
  it('parses model JSON into ProblemMeta', async () => {
    const meta = await classify('A train...', new FakeModel([json]))
    expect(meta.domain).toBe('arithmetic')
    expect(meta.difficulty).toBe(3)
    expect(meta.isMCQ).toBe(true)
    expect(meta.options).toEqual(['10', '20'])
  })

  it('defaults to best-effort meta when JSON is unparseable', async () => {
    const meta = await classify('x', new FakeModel(['not json']))
    expect(meta.domain).toBe('verbal')
    expect(meta.ambiguity).toContain('classifier-parse-failed')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/classifier/classifier.test.ts`
Expected: FAIL — cannot find module `@/classifier/classifier`.

- [ ] **Step 3: Write minimal implementation**

`src/classifier/types.ts`:
```ts
export type Domain = 'arithmetic' | 'verbal' | 'logic' | 'di' | 'visual'

export interface ProblemMeta {
  domain: Domain
  subDomain: string
  type: string
  difficulty: 1 | 2 | 3 | 4 | 5
  ambiguity: string[]
  isMCQ: boolean
  options?: string[]
}
```

`src/classifier/classifier.ts`:
```ts
import { ModelPort } from '@/model/types'
import { ProblemMeta, Domain } from './types'

const DOMAINS: Domain[] = ['arithmetic', 'verbal', 'logic', 'di', 'visual']

const PROMPT = (p: string) => `Classify this competitive-exam problem. Reply ONLY JSON:
{"domain":"arithmetic|verbal|logic|di|visual","subDomain":string,"type":string,"difficulty":1-5,"ambiguity":string[],"isMCQ":boolean,"options":string[]?}
Problem:
${p}`

export async function classify(text: string, model: ModelPort): Promise<ProblemMeta> {
  const raw = await model.complete([{ role: 'user', content: PROMPT(text) }], { json: true })
  try {
    const o = JSON.parse(raw)
    const domain: Domain = DOMAINS.includes(o.domain) ? o.domain : 'verbal'
    const d = Number(o.difficulty)
    return {
      domain,
      subDomain: String(o.subDomain ?? 'unknown'),
      type: String(o.type ?? 'unknown'),
      difficulty: (d >= 1 && d <= 5 ? d : 3) as ProblemMeta['difficulty'],
      ambiguity: Array.isArray(o.ambiguity) ? o.ambiguity.map(String) : [],
      isMCQ: Boolean(o.isMCQ),
      options: Array.isArray(o.options) ? o.options.map(String) : undefined
    }
  } catch {
    return { domain: 'verbal', subDomain: 'unknown', type: 'unknown', difficulty: 3,
      ambiguity: ['classifier-parse-failed'], isMCQ: false }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/classifier/classifier.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/classifier/types.ts src/classifier/classifier.ts tests/classifier/classifier.test.ts
git commit -m "feat: zero-shot LLM problem classifier with safe fallback"
```

---

### Task 4: Scratchpad + result types

**Files:**
- Create: `src/pipeline/scratchpad.ts`, `tests/pipeline/scratchpad.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/pipeline/scratchpad.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { emptyScratchpad } from '@/pipeline/scratchpad'

describe('emptyScratchpad', () => {
  it('initializes with best-effort state and zero confidence', () => {
    const s = emptyScratchpad('2+2?', {
      domain: 'arithmetic', subDomain: 's', type: 't', difficulty: 1,
      ambiguity: [], isMCQ: false
    })
    expect(s.problem).toBe('2+2?')
    expect(s.verifyState).toBe('best-effort')
    expect(s.confidence).toBe(0)
    expect(s.stages).toEqual({})
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pipeline/scratchpad.test.ts`
Expected: FAIL — cannot find module `@/pipeline/scratchpad`.

- [ ] **Step 3: Write minimal implementation**

`src/pipeline/scratchpad.ts`:
```ts
import { ProblemMeta } from '@/classifier/types'

export type VerifyState = 'verified' | 'best-effort'

export interface Scratchpad {
  problem: string
  meta: ProblemMeta
  similar: string[]
  stages: Record<string, string>
  computation?: string
  constraints?: string
  llmAnswer?: string
  verifiedAnswer?: string
  verifyState: VerifyState
  confidence: number
  newQuestion?: string
  discrepancy?: string
}

export function emptyScratchpad(problem: string, meta: ProblemMeta): Scratchpad {
  return { problem, meta, similar: [], stages: {}, verifyState: 'best-effort', confidence: 0 }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pipeline/scratchpad.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/scratchpad.ts tests/pipeline/scratchpad.test.ts
git commit -m "feat: Scratchpad type and initializer"
```

---

### Task 5: Python verify sidecar (arithmetic via SymPy)

**Files:**
- Create: `src/verify/sidecar.py`, `tests/verify/sidecar.arithmetic.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/verify/sidecar.arithmetic.test.ts`:
```ts
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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/verify/sidecar.arithmetic.test.ts`
Expected: FAIL — `src/verify/sidecar.py` does not exist (ENOENT).

- [ ] **Step 3: Write minimal implementation**

`src/verify/sidecar.py`:
```python
import sys, json, io, contextlib

def run_arithmetic(code: str):
    buf = io.StringIO()
    safe = {"__builtins__": {"print": print, "range": range, "len": len, "abs": abs,
                              "round": round, "min": min, "max": max, "sum": sum, "pow": pow}}
    try:
        import sympy  # noqa: F401
        safe["sympy"] = sympy
    except Exception:
        pass
    try:
        with contextlib.redirect_stdout(buf):
            exec(code, safe, {})
        return {"ok": True, "value": buf.getvalue().strip()}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}

def run_logic(smt: str):
    try:
        from z3 import Solver, parse_smt2_string
        s = Solver()
        s.add(parse_smt2_string(smt))
        r = s.check()
        if str(r) == "sat":
            return {"status": "sat", "solution": str(s.model())}
        if str(r) == "unsat":
            return {"status": "unsat"}
        return {"status": "error", "error": "unknown"}
    except Exception as e:
        return {"status": "error", "error": f"{type(e).__name__}: {e}"}

def main():
    req = json.loads(sys.stdin.read())
    op = req.get("op")
    if op == "arithmetic":
        out = run_arithmetic(req.get("code", ""))
    elif op == "logic":
        out = run_logic(req.get("smt", ""))
    else:
        out = {"ok": False, "error": "unknown op"}
    sys.stdout.write(json.dumps(out))

if __name__ == "__main__":
    main()
```

Run once to install deps: `python3 -m pip install sympy z3-solver`

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 -m pip install sympy z3-solver && npx vitest run tests/verify/sidecar.arithmetic.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/verify/sidecar.py tests/verify/sidecar.arithmetic.test.ts
git commit -m "feat: python verify sidecar with sandboxed arithmetic op"
```

---

### Task 6: Arithmetic verifier wrapper

**Files:**
- Create: `src/verify/arithmetic.ts`, `tests/verify/arithmetic.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/verify/arithmetic.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/verify/arithmetic.test.ts`
Expected: FAIL — cannot find module `@/verify/arithmetic`.

- [ ] **Step 3: Write minimal implementation**

`src/verify/arithmetic.ts`:
```ts
import { execFile } from 'node:child_process'

export interface ArithResult { ok: boolean; value?: string; error?: string }

export function verifyArithmetic(code: string): Promise<ArithResult> {
  return new Promise((resolve) => {
    const child = execFile('python3', ['src/verify/sidecar.py'],
      { timeout: 5000 },
      (err, stdout) => {
        if (stdout) { try { return resolve(JSON.parse(stdout)) } catch { /* fallthrough */ } }
        resolve({ ok: false, error: err ? String(err.message) : 'no output' })
      })
    child.stdin?.end(JSON.stringify({ op: 'arithmetic', code }))
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/verify/arithmetic.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/verify/arithmetic.ts tests/verify/arithmetic.test.ts
git commit -m "feat: arithmetic verifier (Program-of-Thought execution)"
```

---

### Task 7: Logic verifier (Z3 via sidecar)

**Files:**
- Create: `src/verify/logic.ts`, `tests/verify/logic.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/verify/logic.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/verify/logic.test.ts`
Expected: FAIL — cannot find module `@/verify/logic`.

- [ ] **Step 3: Write minimal implementation**

`src/verify/logic.ts`:
```ts
import { execFile } from 'node:child_process'

export interface LogicResult {
  status: 'sat' | 'unsat' | 'multiple' | 'error'
  solution?: string
  error?: string
}

export function verifyLogic(smt: string): Promise<LogicResult> {
  return new Promise((resolve) => {
    const child = execFile('python3', ['src/verify/sidecar.py'],
      { timeout: 8000 },
      (err, stdout) => {
        if (stdout) { try { return resolve(JSON.parse(stdout)) } catch { /* fallthrough */ } }
        resolve({ status: 'error', error: err ? String(err.message) : 'no output' })
      })
    child.stdin?.end(JSON.stringify({ op: 'logic', smt }))
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/verify/logic.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/verify/logic.ts tests/verify/logic.test.ts
git commit -m "feat: logic verifier via Z3 sidecar"
```

---

### Task 8: Verbal verifier (NLI-as-LLM → confidence)

**Files:**
- Create: `src/verify/verbal.ts`, `tests/verify/verbal.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/verify/verbal.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { FakeModel } from '@/model/fake'
import { verifyVerbal } from '@/verify/verbal'

describe('verifyVerbal', () => {
  it('maps entailment JSON to a confidence score', async () => {
    const m = new FakeModel([JSON.stringify({ entailment: 'entail', confidence: 88 })])
    const r = await verifyVerbal('answer', 'passage', m)
    expect(r.entailment).toBe('entail')
    expect(r.confidence).toBe(88)
  })
  it('returns low confidence on parse failure', async () => {
    const r = await verifyVerbal('a', 'p', new FakeModel(['garbage']))
    expect(r.entailment).toBe('neutral')
    expect(r.confidence).toBeLessThanOrEqual(20)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/verify/verbal.test.ts`
Expected: FAIL — cannot find module `@/verify/verbal`.

- [ ] **Step 3: Write minimal implementation**

`src/verify/verbal.ts`:
```ts
import { ModelPort } from '@/model/types'

export interface VerbalResult {
  entailment: 'entail' | 'neutral' | 'contradict'
  confidence: number
}

const PROMPT = (a: string, p: string) => `Is the ANSWER entailed by the SOURCE?
Reply ONLY JSON: {"entailment":"entail|neutral|contradict","confidence":0-100}
SOURCE:
${p}
ANSWER:
${a}`

export async function verifyVerbal(answer: string, source: string, model: ModelPort): Promise<VerbalResult> {
  const raw = await model.complete([{ role: 'user', content: PROMPT(answer, source) }], { json: true })
  try {
    const o = JSON.parse(raw)
    const e = ['entail', 'neutral', 'contradict'].includes(o.entailment) ? o.entailment : 'neutral'
    const c = Number(o.confidence)
    return { entailment: e, confidence: Number.isFinite(c) ? Math.max(0, Math.min(100, c)) : 10 }
  } catch {
    return { entailment: 'neutral', confidence: 10 }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/verify/verbal.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/verify/verbal.ts tests/verify/verbal.test.ts
git commit -m "feat: verbal NLI-as-LLM confidence verifier"
```

---

### Task 9: Self-consistency majority vote

**Files:**
- Create: `src/consistency/vote.ts`, `tests/consistency/vote.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/consistency/vote.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { majorityVote } from '@/consistency/vote'

describe('majorityVote', () => {
  it('picks the most common answer and reports agreement', () => {
    expect(majorityVote(['7', '7', '9', '7'])).toEqual({ winner: '7', agreement: 0.75 })
  })
  it('normalizes whitespace/case before counting', () => {
    expect(majorityVote([' Ten ', 'ten', 'TEN'])).toEqual({ winner: 'ten', agreement: 1 })
  })
  it('handles empty input', () => {
    expect(majorityVote([])).toEqual({ winner: '', agreement: 0 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/consistency/vote.test.ts`
Expected: FAIL — cannot find module `@/consistency/vote`.

- [ ] **Step 3: Write minimal implementation**

`src/consistency/vote.ts`:
```ts
export function majorityVote(answers: string[]): { winner: string; agreement: number } {
  if (answers.length === 0) return { winner: '', agreement: 0 }
  const norm = (s: string) => s.trim().toLowerCase()
  const counts = new Map<string, number>()
  for (const a of answers) counts.set(norm(a), (counts.get(norm(a)) ?? 0) + 1)
  let winner = ''
  let best = 0
  for (const [k, v] of counts) if (v > best) { best = v; winner = k }
  return { winner, agreement: best / answers.length }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/consistency/vote.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/consistency/vote.ts tests/consistency/vote.test.ts
git commit -m "feat: self-consistency majority vote"
```

---

### Task 10: In-memory RAG store

**Files:**
- Create: `src/memory/types.ts`, `src/memory/inmemory.ts`, `tests/memory/inmemory.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/memory/inmemory.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { FakeModel } from '@/model/fake'
import { InMemoryStore } from '@/memory/inmemory'
import { ProblemMeta } from '@/classifier/types'

const meta: ProblemMeta = { domain: 'arithmetic', subDomain: 's', type: 't',
  difficulty: 1, ambiguity: [], isMCQ: false }

describe('InMemoryStore', () => {
  it('returns nothing before any writes', async () => {
    const s = new InMemoryStore(new FakeModel([]))
    expect(await s.search('train speed', 3)).toEqual([])
  })
  it('retrieves the nearest written trace', async () => {
    const s = new InMemoryStore(new FakeModel([]))
    await s.write({ problem: 'train speed problem', meta, answer: '60', output: 'o1' })
    await s.write({ problem: 'totally unrelated poem', meta, answer: 'x', output: 'o2' })
    const res = await s.search('a problem about train speed', 1)
    expect(res).toHaveLength(1)
    expect(res[0].answer).toBe('60')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/memory/inmemory.test.ts`
Expected: FAIL — cannot find module `@/memory/inmemory`.

- [ ] **Step 3: Write minimal implementation**

`src/memory/types.ts`:
```ts
import { ProblemMeta } from '@/classifier/types'

export interface SolvedTrace {
  problem: string
  meta: ProblemMeta
  answer: string
  output: string
}

export interface MemoryPort {
  search(query: string, k: number): Promise<SolvedTrace[]>
  write(trace: SolvedTrace): Promise<void>
}
```

`src/memory/inmemory.ts`:
```ts
import { ModelPort } from '@/model/types'
import { MemoryPort, SolvedTrace } from './types'

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

export class InMemoryStore implements MemoryPort {
  private items: { vec: number[]; trace: SolvedTrace }[] = []
  constructor(private model: ModelPort) {}

  async write(trace: SolvedTrace): Promise<void> {
    this.items.push({ vec: await this.model.embed(trace.problem), trace })
  }

  async search(query: string, k: number): Promise<SolvedTrace[]> {
    if (this.items.length === 0) return []
    const q = await this.model.embed(query)
    return [...this.items]
      .map((it) => ({ s: cosine(q, it.vec), t: it.trace }))
      .sort((x, y) => y.s - x.s)
      .slice(0, k)
      .map((r) => r.t)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/memory/inmemory.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/memory/types.ts src/memory/inmemory.ts tests/memory/inmemory.test.ts
git commit -m "feat: in-memory RAG store behind MemoryPort"
```

---

### Task 11: Stage prompt builders + parsers

**Files:**
- Create: `src/pipeline/stages.ts`, `tests/pipeline/stages.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/pipeline/stages.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildStagePrompt, parseExecute, STAGE_NAMES } from '@/pipeline/stages'
import { emptyScratchpad } from '@/pipeline/scratchpad'

const s = emptyScratchpad('A train runs 120km in 2h. Speed?', {
  domain: 'arithmetic', subDomain: 'tsd', type: 'trains', difficulty: 2,
  ambiguity: [], isMCQ: false
})

describe('stages', () => {
  it('exposes the 9 stage names in order', () => {
    expect(STAGE_NAMES).toHaveLength(9)
    expect(STAGE_NAMES[0]).toBe('ingestion')
    expect(STAGE_NAMES[8]).toBe('articulation')
  })
  it('builds a prompt that includes the problem and prior stage text', () => {
    s.stages['ingestion'] = 'understood'
    const p = buildStagePrompt('strategy', s)
    expect(p).toContain('A train runs 120km')
    expect(p).toContain('understood')
  })
  it('parses fenced python out of an execute-stage response', () => {
    const r = parseExecute('Reasoning...\n```python\nprint(120/2)\n```\nANSWER: 60')
    expect(r.code).toBe('print(120/2)')
    expect(r.answer).toBe('60')
  })
  it('parses ANSWER line when no code block present', () => {
    const r = parseExecute('Some prose.\nANSWER: 42')
    expect(r.code).toBeUndefined()
    expect(r.answer).toBe('42')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pipeline/stages.test.ts`
Expected: FAIL — cannot find module `@/pipeline/stages`.

- [ ] **Step 3: Write minimal implementation**

`src/pipeline/stages.ts`:
```ts
import { Scratchpad } from './scratchpad'

export const STAGE_NAMES = [
  'ingestion', 'formal', 'strategy', 'execute', 'constraint',
  'adversarial', 'altmethod', 'options', 'articulation'
] as const
export type StageName = typeof STAGE_NAMES[number]

const STAGE_INSTRUCTION: Record<StageName, string> = {
  ingestion: 'Re-read the problem. State domain, what is given, what is asked, and any traps.',
  formal: 'Translate to formal/symbolic representation. Define every variable and list numbered constraints.',
  strategy: 'Give >=2 valid strategies and pick the optimal one with justification.',
  execute: 'Execute the chosen strategy step by step. If quantitative, OUTPUT a fenced ```python``` block that prints the answer. End with a line "ANSWER: <value>".',
  constraint: 'Check every derived value against the original constraints. Flag any violation.',
  adversarial: 'Act as a counter-solver. Attack the answer. Identify the most likely error for this problem class.',
  altmethod: 'Solve again with a different method. State whether it agrees. End with "ANSWER: <value>".',
  options: 'If MCQ, verify the answer matches exactly one option. If not MCQ, restate the final value.',
  articulation: 'State the final answer unambiguously and one key insight/trap. End with "ANSWER: <value>".'
}

export function buildStagePrompt(stage: StageName, s: Scratchpad): string {
  const prior = STAGE_NAMES
    .filter((n) => s.stages[n])
    .map((n) => `[${n}]\n${s.stages[n]}`)
    .join('\n\n')
  const sim = s.similar.length ? `\nAnalogous solved problems:\n${s.similar.join('\n---\n')}\n` : ''
  return `You are APEX-REASON. Domain: ${s.meta.domain}/${s.meta.subDomain}.
PROBLEM:
${s.problem}
${sim}
Prior work:
${prior || '(none)'}

STAGE = ${stage}. ${STAGE_INSTRUCTION[stage]}`
}

export function parseExecute(text: string): { code?: string; answer?: string } {
  const code = text.match(/```python\s*([\s\S]*?)```/)?.[1]?.trim()
  const answer = text.match(/ANSWER:\s*(.+)\s*$/m)?.[1]?.trim()
  return { code: code || undefined, answer: answer || undefined }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pipeline/stages.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/stages.ts tests/pipeline/stages.test.ts
git commit -m "feat: 9-stage prompt builders and execute-stage parser"
```

---

### Task 12: Pipeline orchestration with reconciliation

**Files:**
- Create: `src/pipeline/pipeline.ts`, `tests/pipeline/pipeline.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/pipeline/pipeline.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { FakeModel } from '@/model/fake'
import { InMemoryStore } from '@/memory/inmemory'
import { solve } from '@/pipeline/pipeline'

// 1 classify + 9 stages = 10 scripted completions.
function script(answer: string, code: string): string[] {
  const cls = JSON.stringify({ domain: 'arithmetic', subDomain: 'tsd', type: 'trains',
    difficulty: 2, ambiguity: [], isMCQ: false })
  const stages = [
    'ingested', 'formalized', 'strategy chosen',
    'work...\n```python\n' + code + '\n```\nANSWER: ' + answer,
    'constraints ok', 'adversarial ok', 'alt agrees\nANSWER: ' + answer,
    'not mcq', 'final\nANSWER: ' + answer
  ]
  return [cls, ...stages]
}

describe('solve', () => {
  it('marks arithmetic verified when LLM answer matches executed value', async () => {
    const model = new FakeModel(script('60', 'print(120//2)'))
    const mem = new InMemoryStore(model)
    const s = await solve('A train runs 120km in 2h. Speed?', { model, memory: mem, n: 1 })
    expect(s.verifyState).toBe('verified')
    expect(s.verifiedAnswer).toBe('60')
    expect(s.discrepancy).toBeUndefined()
  })

  it('flags a discrepancy and trusts the verifier when they disagree', async () => {
    const model = new FakeModel(script('99', 'print(120//2)'))
    const mem = new InMemoryStore(model)
    const s = await solve('A train runs 120km in 2h. Speed?', { model, memory: mem, n: 1 })
    expect(s.verifiedAnswer).toBe('60')
    expect(s.discrepancy).toContain('99')
    expect(s.verifyState).toBe('verified')
  })

  it('writes the solved trace to memory', async () => {
    const model = new FakeModel(script('60', 'print(120//2)'))
    const mem = new InMemoryStore(model)
    await solve('A train runs 120km in 2h. Speed?', { model, memory: mem, n: 1 })
    const found = await mem.search('train speed', 1)
    expect(found[0]?.answer).toBe('60')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pipeline/pipeline.test.ts`
Expected: FAIL — cannot find module `@/pipeline/pipeline`.

- [ ] **Step 3: Write minimal implementation**

`src/pipeline/pipeline.ts`:
```ts
import { ModelPort } from '@/model/types'
import { MemoryPort } from '@/memory/types'
import { classify } from '@/classifier/classifier'
import { emptyScratchpad, Scratchpad } from './scratchpad'
import { STAGE_NAMES, buildStagePrompt, parseExecute } from './stages'
import { verifyArithmetic } from '@/verify/arithmetic'

export interface SolveDeps {
  model: ModelPort
  memory: MemoryPort
  n?: number
}

async function runStages(text: string, s: Scratchpad, model: ModelPort): Promise<void> {
  for (const stage of STAGE_NAMES) {
    const out = await model.complete(
      [{ role: 'user', content: buildStagePrompt(stage, s) }],
      { temperature: 0.7 }
    )
    s.stages[stage] = out
    if (stage === 'execute') {
      const parsed = parseExecute(out)
      s.computation = parsed.code
      s.llmAnswer = parsed.answer
    }
    if (stage === 'articulation') {
      const a = parseExecute(out).answer
      if (a) s.llmAnswer = a
    }
  }
}

export async function solve(text: string, deps: SolveDeps): Promise<Scratchpad> {
  const meta = await classify(text, deps.model)
  const s = emptyScratchpad(text, meta)
  s.similar = (await deps.memory.search(text, 3)).map((t) => `Q: ${t.problem}\nA: ${t.answer}`)

  await runStages(text, s, deps.model)

  if (meta.domain === 'arithmetic' && s.computation) {
    const r = await verifyArithmetic(s.computation)
    if (r.ok && r.value !== undefined) {
      s.verifiedAnswer = r.value
      s.verifyState = 'verified'
      s.confidence = 100
      if (s.llmAnswer && s.llmAnswer.trim() !== r.value.trim()) {
        s.discrepancy = `LLM answered "${s.llmAnswer}" but verified value is "${r.value}"`
      }
    } else {
      s.verifyState = 'best-effort'
      s.confidence = 25
      s.discrepancy = `arithmetic verification failed: ${r.error ?? 'unknown'}`
    }
  } else {
    s.verifyState = 'best-effort'
    s.confidence = 60
    s.verifiedAnswer = s.llmAnswer
  }

  const finalAnswer = s.verifiedAnswer ?? s.llmAnswer ?? ''
  await deps.memory.write({ problem: text, meta, answer: finalAnswer, output: s.stages['articulation'] ?? '' })
  return s
}
```

> Note: `n` (self-consistency repetitions) is wired in Task 13 once the renderer exists; v1 default path uses `n=1`. The `majorityVote` import is added there to avoid an unused import now.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pipeline/pipeline.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/pipeline.ts tests/pipeline/pipeline.test.ts
git commit -m "feat: 9-stage pipeline with arithmetic reconciliation"
```

---

### Task 13: Self-consistency wiring into the pipeline

**Files:**
- Modify: `src/pipeline/pipeline.ts`
- Create: `tests/pipeline/consistency.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/pipeline/consistency.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { ModelPort, Message } from '@/model/types'
import { InMemoryStore } from '@/memory/inmemory'
import { solve } from '@/pipeline/pipeline'

// Model that returns a fixed classify, then a per-call answer queue for stages.
class ScriptModel implements ModelPort {
  private q: string[]
  constructor(answers: string[]) {
    const cls = JSON.stringify({ domain: 'verbal', subDomain: 's', type: 't',
      difficulty: 2, ambiguity: [], isMCQ: false })
    // 9 stages per attempt; last stage carries ANSWER. Build attempts.
    this.q = []
    for (const a of answers) {
      this.q.push(cls)
      for (let i = 0; i < 8; i++) this.q.push('step')
      this.q.push('final\nANSWER: ' + a)
    }
  }
  async complete(_m: Message[]): Promise<string> {
    return this.q.shift() ?? 'step'
  }
  async embed(): Promise<number[]> { return [1, 0, 0, 0, 0, 0, 0, 0] }
}

describe('self-consistency', () => {
  it('uses majority answer across n attempts for non-verified domains', async () => {
    const model = new ScriptModel(['blue', 'blue', 'red'])
    const s = await solve('what color?', { model, memory: new InMemoryStore(model), n: 3 })
    expect(s.verifiedAnswer).toBe('blue')
    expect(s.confidence).toBeGreaterThanOrEqual(60)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pipeline/consistency.test.ts`
Expected: FAIL — current `solve` ignores `n`; `verifiedAnswer` will be `'red'` (last attempt) not `'blue'`.

- [ ] **Step 3: Modify implementation**

In `src/pipeline/pipeline.ts`, add the import at the top:
```ts
import { majorityVote } from '@/consistency/vote'
```

Replace the `else` branch (the non-arithmetic block) inside `solve` with:
```ts
  } else {
    const n = Math.max(1, deps.n ?? 1)
    const answers: string[] = [s.llmAnswer ?? '']
    for (let i = 1; i < n; i++) {
      const extra = emptyScratchpad(text, meta)
      extra.similar = s.similar
      await runStages(text, extra, deps.model)
      answers.push(extra.llmAnswer ?? '')
    }
    const { winner, agreement } = majorityVote(answers)
    s.verifyState = 'best-effort'
    s.verifiedAnswer = winner || s.llmAnswer
    s.confidence = Math.round(60 + 40 * agreement)
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pipeline/consistency.test.ts && npx vitest run tests/pipeline/pipeline.test.ts`
Expected: PASS (1 new test; the 3 Task-12 tests still PASS because their default `n=1` yields a single-answer vote).

- [ ] **Step 5: Commit**

```bash
git add src/pipeline/pipeline.ts tests/pipeline/consistency.test.ts
git commit -m "feat: self-consistency voting for non-verified domains"
```

---

### Task 14: Output renderer with Verified/Confidence labelling

**Files:**
- Create: `src/render/render.ts`, `tests/render/render.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/render/render.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { renderOutput } from '@/render/render'
import { emptyScratchpad } from '@/pipeline/scratchpad'

function base() {
  const s = emptyScratchpad('Q?', { domain: 'arithmetic', subDomain: 'tsd',
    type: 'trains', difficulty: 2, ambiguity: [], isMCQ: false })
  s.stages = { ingestion: 'i', formal: 'f', strategy: 'st', execute: 'e',
    constraint: 'c', adversarial: 'a', altmethod: 'm', options: 'o', articulation: 'final' }
  return s
}

describe('renderOutput', () => {
  it('renders all fixed sections', () => {
    const s = base(); s.verifyState = 'verified'; s.verifiedAnswer = '60'; s.confidence = 100
    const out = renderOutput(s)
    for (const tag of ['【PROBLEM TYPE】', '【PARSING】', '【STRATEGY】',
      '【SOLUTION】', '【VERIFICATION】', '【ANSWER】', '【INSIGHT】', '【NEW Q】']) {
      expect(out).toContain(tag)
    }
    expect(out).toContain('VERIFIED')
    expect(out).toContain('60')
  })

  it('labels verbal output as best-effort with confidence and never VERIFIED', () => {
    const s = base()
    s.meta.domain = 'verbal'
    s.verifyState = 'best-effort'; s.verifiedAnswer = 'B'; s.confidence = 72
    const out = renderOutput(s)
    expect(out).toContain('BEST-EFFORT')
    expect(out).toContain('72')
    expect(out).not.toContain('VERIFIED')
  })

  it('surfaces a discrepancy note when present', () => {
    const s = base(); s.verifyState = 'verified'; s.verifiedAnswer = '60'
    s.discrepancy = 'LLM answered "99" but verified value is "60"'
    expect(renderOutput(s)).toContain('99')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/render.test.ts`
Expected: FAIL — cannot find module `@/render/render`.

- [ ] **Step 3: Write minimal implementation**

`src/render/render.ts`:
```ts
import { Scratchpad } from '@/pipeline/scratchpad'

export function renderOutput(s: Scratchpad): string {
  const label = s.verifyState === 'verified'
    ? 'VERIFIED (machine-checked)'
    : `BEST-EFFORT — confidence ${s.confidence}/100`
  const disc = s.discrepancy ? `\n⚠ Discrepancy: ${s.discrepancy}` : ''
  const answer = s.verifiedAnswer ?? s.llmAnswer ?? '(none)'
  return [
    `【PROBLEM TYPE】 ${s.meta.domain} → ${s.meta.subDomain} → ${s.meta.type} → L${s.meta.difficulty}`,
    `【PARSING】 ${s.stages['ingestion'] ?? ''}`,
    `【STRATEGY】 ${s.stages['strategy'] ?? ''}`,
    `【SOLUTION】\n${s.stages['execute'] ?? ''}`,
    `【VERIFICATION】 [${label}] ${s.stages['altmethod'] ?? ''}${disc}`,
    `【ANSWER】 ✓ ${answer}`,
    `【INSIGHT】 ${s.stages['adversarial'] ?? ''}`,
    `【NEW Q】 ${s.newQuestion ?? '(generation deferred to sub-project 2)'}`
  ].join('\n\n')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render/render.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/render/render.ts tests/render/render.test.ts
git commit -m "feat: output renderer enforcing Verified/Confidence honesty labels"
```

---

### Task 15: Next.js solve endpoint + minimal UI

**Files:**
- Create: `src/app/api/solve/route.ts`, `src/app/page.tsx`, `src/app/layout.tsx`, `next-env.d.ts`, `tests/app/route.test.ts`
- Modify: `tsconfig.json` (already includes `src`; no change needed if `jsx` preserve set — verify)

- [ ] **Step 1: Write the failing test**

`tests/app/route.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/model/anthropic', () => ({
  AnthropicModel: class {
    private q = [
      JSON.stringify({ domain: 'arithmetic', subDomain: 'tsd', type: 'trains',
        difficulty: 2, ambiguity: [], isMCQ: false }),
      'i', 'f', 's', 'work\n```python\nprint(120//2)\n```\nANSWER: 60',
      'c', 'a', 'alt\nANSWER: 60', 'o', 'final\nANSWER: 60'
    ]
    async complete() { return this.q.shift() ?? 'x' }
    async embed() { return [1, 0, 0, 0, 0, 0, 0, 0] }
  }
}))

import { POST } from '@/app/api/solve/route'

describe('POST /api/solve', () => {
  it('returns rendered output for a problem', async () => {
    const req = new Request('http://x/api/solve', {
      method: 'POST', body: JSON.stringify({ problem: 'A train runs 120km in 2h. Speed?' })
    })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.output).toContain('【ANSWER】')
    expect(body.output).toContain('60')
    expect(body.output).toContain('VERIFIED')
  })

  it('returns 400 when problem is missing', async () => {
    const res = await POST(new Request('http://x/api/solve', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/route.test.ts`
Expected: FAIL — cannot find module `@/app/api/solve/route`.

- [ ] **Step 3: Write minimal implementation**

`src/model/anthropic.ts`:
```ts
import Anthropic from '@anthropic-ai/sdk'
import { ModelPort, Message, CompleteOpts } from './types'

export class AnthropicModel implements ModelPort {
  private client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  async complete(messages: Message[], opts?: CompleteOpts): Promise<string> {
    const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n')
    const msgs = messages.filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    const r = await this.client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      temperature: opts?.temperature ?? 0.7,
      system: sys || undefined,
      messages: msgs
    })
    const block = r.content[0]
    return block.type === 'text' ? block.text : ''
  }

  async embed(text: string): Promise<number[]> {
    const v = new Array(8).fill(0)
    for (let k = 0; k < text.length; k++) v[k % 8] += text.charCodeAt(k)
    return v
  }
}
```
> Embedding is a deterministic placeholder (matches FakeModel) so v1 needs no embedding provider; swapping in a real embedding model is a one-method change behind `ModelPort`. When implementing this file, follow the `claude-api` skill for SDK usage and add prompt caching on the system prompt.

`src/app/api/solve/route.ts`:
```ts
import { AnthropicModel } from '@/model/anthropic'
import { InMemoryStore } from '@/memory/inmemory'
import { solve } from '@/pipeline/pipeline'
import { renderOutput } from '@/render/render'

const model = new AnthropicModel()
const memory = new InMemoryStore(model)

export async function POST(req: Request): Promise<Response> {
  let problem = ''
  try { problem = String((await req.json()).problem ?? '') } catch { /* invalid json */ }
  if (!problem.trim()) {
    return new Response(JSON.stringify({ error: 'problem is required' }),
      { status: 400, headers: { 'content-type': 'application/json' } })
  }
  const s = await solve(problem, { model, memory, n: 1 })
  return new Response(JSON.stringify({ output: renderOutput(s), state: s.verifyState }),
    { status: 200, headers: { 'content-type': 'application/json' } })
}
```

`src/app/layout.tsx`:
```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>)
}
```

`src/app/page.tsx`:
```tsx
'use client'
import { useState } from 'react'

export default function Home() {
  const [problem, setProblem] = useState('')
  const [out, setOut] = useState('')
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true); setOut('')
    const res = await fetch('/api/solve', {
      method: 'POST', body: JSON.stringify({ problem })
    })
    const body = await res.json()
    setOut(body.output ?? body.error ?? 'error')
    setLoading(false)
  }

  return (
    <main style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'system-ui' }}>
      <h1>APEX-REASON</h1>
      <textarea value={problem} onChange={(e) => setProblem(e.target.value)}
        rows={6} style={{ width: '100%' }} placeholder="Paste a CAT-style problem..." />
      <button onClick={run} disabled={loading || !problem.trim()}>
        {loading ? 'Solving…' : 'Solve'}
      </button>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#f5f5f7', padding: 16 }}>{out}</pre>
    </main>
  )
}
```

`next-env.d.ts`:
```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/app/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: ALL tests PASS across every task file.

- [ ] **Step 6: Commit**

```bash
git add src/model/anthropic.ts src/app tests/app/route.test.ts next-env.d.ts
git commit -m "feat: Next.js /api/solve endpoint and minimal solver UI"
```

---

### Task 16: End-to-end golden set harness

**Files:**
- Create: `tests/golden/cases.json`, `tests/golden/golden.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/golden/cases.json`:
```json
[
  { "problem": "A train covers 360 km in 4 hours. What is its speed in km/h?", "expected": "90", "domain": "arithmetic" },
  { "problem": "If 8 workers build a wall in 10 days, how many days for 16 workers at the same rate?", "expected": "5", "domain": "arithmetic" }
]
```

`tests/golden/golden.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import cases from './cases.json'
import { FakeModel } from '@/model/fake'
import { InMemoryStore } from '@/memory/inmemory'
import { solve } from '@/pipeline/pipeline'

// Drives the pipeline with a model that emits correct PoT code per case,
// proving the verified path yields the known answer end-to-end.
function modelFor(expected: string, code: string) {
  return new FakeModel([
    JSON.stringify({ domain: 'arithmetic', subDomain: 's', type: 't',
      difficulty: 2, ambiguity: [], isMCQ: false }),
    'i', 'f', 's',
    'work\n```python\n' + code + '\n```\nANSWER: ' + expected,
    'c', 'a', 'alt\nANSWER: ' + expected, 'o', 'final\nANSWER: ' + expected
  ])
}

describe('golden set (verified path)', () => {
  it('case 0: train speed', async () => {
    const m = modelFor(cases[0].expected, 'print(360//4)')
    const s = await solve(cases[0].problem, { model: m, memory: new InMemoryStore(m), n: 1 })
    expect(s.verifyState).toBe('verified')
    expect(s.verifiedAnswer).toBe('90')
  })
  it('case 1: men-days', async () => {
    const m = modelFor(cases[1].expected, 'print(8*10//16)')
    const s = await solve(cases[1].problem, { model: m, memory: new InMemoryStore(m), n: 1 })
    expect(s.verifyState).toBe('verified')
    expect(s.verifiedAnswer).toBe('5')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/golden/golden.test.ts`
Expected: FAIL — `tests/golden/cases.json` / test file not found until created.

- [ ] **Step 3: No new implementation needed**

The harness exercises existing code. (If the JSON import errors, add `"resolveJsonModule": true` to `tsconfig.json` `compilerOptions`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/golden/golden.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add tests/golden/cases.json tests/golden/golden.test.ts tsconfig.json
git commit -m "test: end-to-end golden set for the verified arithmetic path"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task(s) |
|---|---|
| §2 SOLVE mode, 6 domains | classifier (3), pipeline (12) |
| §2 9-stage CoT | stages (11), pipeline (12) |
| §2 Program-of-Thought arithmetic | sidecar (5), arithmetic (6), pipeline reconciliation (12) |
| §2 Z3 logic verification | sidecar (5), logic (7) |
| §2 sentence-correction/verbal best-effort | verbal (8) |
| §2 self-consistency | vote (9), wiring (13) |
| §2 RAG memory (episodic) | memory (10), pipeline write (12) |
| §2 honesty model (Verified vs confidence) | renderer (14) + invariant test |
| §2 single 【NEW Q】 | renderer (14) emits placeholder; full gen = roadmap (correctly deferred) |
| §3 architecture / ports | model (2), classifier (3), memory (10) |
| §7 error handling (mismatch/timeout/UNSAT) | sidecar try/except (5), pipeline branches (12) |
| §8 testing (FakeModel, golden set, honesty invariant) | every task; golden (16); invariant in (14) |
| §9 stack (Next.js, Anthropic SDK, Python sidecar) | route/UI (15), anthropic (15) |

Gap check: `【NEW Q】` is intentionally a placeholder per spec §2 (full generation = sub-project 2) — renderer states this explicitly, so it is covered, not missing. Z3 `logic` op is built and unit-tested (7); wiring puzzle constraints *into the pipeline* requires an LLM→SMT translation step that the spec assigns depth-by-domain — for v1 the logic verifier exists and is callable; arithmetic is the fully-wired verified path. This matches spec §11 A3/Q1 (logic verifier present, puzzle-type coverage decided later). No silent gaps.

**2. Placeholder scan:** No "TBD/TODO/handle edge cases" instructions. The one explicit deferral (`【NEW Q】`) is a spec-sanctioned scope boundary, rendered as visible user-facing text, not a plan placeholder.

**3. Type consistency:** `ModelPort.complete/embed`, `ProblemMeta`, `Scratchpad` (incl. `verifyState`, `verifiedAnswer`, `llmAnswer`, `discrepancy`, `confidence`), `MemoryPort.search/write`, `SolvedTrace`, `STAGE_NAMES`, `parseExecute`, `majorityVote`, `verifyArithmetic`/`ArithResult`, `verifyLogic`/`LogicResult`, `renderOutput`, `solve`/`SolveDeps` are used identically across tasks 2–16. `solve` signature `(text, {model, memory, n})` is stable from Task 12 onward; Task 13 modifies only the internal else-branch, not the signature.

Plan is internally consistent; no fixes required.
