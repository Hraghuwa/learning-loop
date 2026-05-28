/**
 * Deterministic arithmetic verifier — pure TypeScript, zero dependencies,
 * zero network, no `eval`/`Function`. Vercel-safe (runs in-process).
 *
 * Purpose: turn the local engine's heuristic "Calculation Error" guess into
 * a PROVEN finding. We extract the student's own numeric equality claims
 * (e.g. "140 × 0.75 = 105", "12 * 8 = 84") from free text, evaluate the
 * left-hand side with a safe recursive-descent parser, and report only the
 * steps that are actually, demonstrably wrong.
 *
 * Honesty contract: if an expression cannot be parsed unambiguously,
 * `safeEval` returns null and the claim is skipped — we never fabricate a
 * "verified" error from something we couldn't actually compute.
 */

const OP_NORMALIZE: Record<string, string> = {
  '×': '*', '·': '*', '∗': '*', '✕': '*', '✖': '*',
  '÷': '/', '∕': '/', '⁄': '/',
  '−': '-', '–': '-', '—': '-',
  '＝': '=', '≈': '=',
};

function normalize(s: string): string {
  let out = ''
  for (const ch of s) out += OP_NORMALIZE[ch] ?? ch
  return out
}

/**
 * Safely evaluate an arithmetic expression over: + - * / ^ ( ) , decimals
 * and unary minus. Returns null for anything outside that grammar, an empty
 * parse, a trailing garbage token, or a division/modulo by zero. Never
 * executes code.
 */
export function safeEval(expr: string): number | null {
  const src = normalize(expr).trim()
  if (!src) return null

  let i = 0
  const peek = () => src[i]
  const eof = () => i >= src.length
  const skipWs = () => { while (!eof() && src[i] === ' ') i++ }

  function parseNumber(): number | null {
    skipWs()
    const start = i
    while (!eof() && /[0-9.]/.test(src[i])) i++
    if (i === start) return null
    const raw = src.slice(start, i)
    if ((raw.match(/\./g) || []).length > 1) return null // 1.2.3
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }

  // primary := number | '(' expr ')' | '-' primary
  function parsePrimary(): number | null {
    skipWs()
    if (eof()) return null
    if (peek() === '(') {
      i++ // consume '('
      const v = parseExpr()
      skipWs()
      if (eof() || src[i] !== ')') return null
      i++ // consume ')'
      return v
    }
    if (peek() === '-') { i++; const v = parsePrimary(); return v === null ? null : -v }
    if (peek() === '+') { i++; return parsePrimary() }
    return parseNumber()
  }

  // power := primary ('^' power)?   (right-associative)
  function parsePower(): number | null {
    const base = parsePrimary()
    if (base === null) return null
    skipWs()
    if (!eof() && src[i] === '^') {
      i++
      const exp = parsePower()
      if (exp === null) return null
      const r = Math.pow(base, exp)
      return Number.isFinite(r) ? r : null
    }
    return base
  }

  // term := power (('*' | '/') power)*
  function parseTerm(): number | null {
    let v = parsePower()
    if (v === null) return null
    for (;;) {
      skipWs()
      const op = peek()
      if (op !== '*' && op !== '/') break
      i++
      const rhs = parsePower()
      if (rhs === null) return null
      if (op === '/') {
        if (rhs === 0) return null
        v = v / rhs
      } else {
        v = v * rhs
      }
    }
    return v
  }

  // expr := term (('+' | '-') term)*
  function parseExpr(): number | null {
    let v = parseTerm()
    if (v === null) return null
    for (;;) {
      skipWs()
      const op = peek()
      if (op !== '+' && op !== '-') break
      i++
      const rhs = parseTerm()
      if (rhs === null) return null
      v = op === '+' ? v + rhs : v - rhs
    }
    return v
  }

  const result = parseExpr()
  skipWs()
  if (!eof()) return null // trailing garbage → ambiguous → refuse
  return result === null || !Number.isFinite(result) ? null : result
}

export type ArithmeticError = {
  /** The student's verbatim claim, e.g. "12 × 8 = 84". */
  claim: string
  /** The left-hand side that was evaluated, e.g. "12 × 8". */
  lhs: string
  /** What the student wrote the result was. */
  stated: number
  /** What the LHS actually evaluates to. */
  actual: number
}

function approxEqual(a: number, b: number): boolean {
  const diff = Math.abs(a - b)
  if (diff <= 1e-9) return true
  // Rounding tolerance: students legitimately round (10.29 ≈ 10.3).
  return diff <= 0.01 * Math.max(Math.abs(a), Math.abs(b), 1)
}

// An equality claim: LHS containing at least one operator, '=', then a number.
// LHS chars are restricted to the safe grammar so we never feed prose in.
const CLAIM_RE =
  /([0-9][0-9.\s()+\-*/^×÷·−–—]*[0-9)])\s*[=＝≈]\s*(-?\d+(?:\.\d+)?)/g

/**
 * Find arithmetic steps the student stated that are demonstrably wrong.
 * Only returns a mismatch when the LHS parses AND the result differs beyond
 * rounding tolerance. Caps output to keep diagnosis focused.
 */
export function findArithmeticErrors(reasoning: string, max = 5): ArithmeticError[] {
  if (!reasoning) return []
  const text = reasoning
  const errors: ArithmeticError[] = []
  CLAIM_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = CLAIM_RE.exec(text)) !== null && errors.length < max) {
    const lhs = m[1].trim()
    if (!/[+\-*/^×÷·−–—]/.test(lhs)) continue // no operator → not a computation

    // Boundary guards: a regex can otherwise slice a fragment out of a
    // chained equality ("a = b = c") or a fraction ("2/7"). Reject unless
    // the claim is a self-contained expression: the char just before the
    // LHS (ignoring spaces) must not continue arithmetic, and the char just
    // after the RHS must not extend it into a fraction/longer number.
    const before = text.slice(0, m.index).replace(/\s+$/, "")
    const prev = before.slice(-1)
    if (prev && /[0-9.=+\-*/^×÷·–—−]/.test(prev)) continue
    const after = text.slice(CLAIM_RE.lastIndex).replace(/^\s+/, "")
    const next = after.slice(0, 1)
    // Block only a true continuation: another digit, '/', '^', or a decimal
    // point that is itself followed by a digit. A sentence-ending '.' is fine.
    if (
      next &&
      (/[0-9/^]/.test(next) || (next === "." && /\d/.test(after.slice(1, 2))))
    )
      continue

    const actual = safeEval(lhs)
    if (actual === null) continue // unparseable → skip (honesty contract)
    const stated = Number(m[2])
    if (!Number.isFinite(stated)) continue
    if (!approxEqual(actual, stated)) {
      errors.push({ claim: m[0].trim(), lhs, stated, actual })
    }
  }
  return errors
}

/** Format a number for prose: trim needless decimals. */
export function fmtNum(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return String(Math.round(n * 1000) / 1000)
}

/**
 * Pull the final computed numeric value out of a worked solution /
 * explanation — the last "= N" or "≈ N", else the last standalone number.
 * Advisory only (used for question-bank QA, not as a hard oracle).
 */
export function extractFinalNumber(text: string): number | null {
  if (!text) return null
  const eq = [...text.matchAll(/[=＝≈]\s*₹?\s*(-?\d+(?:\.\d+)?)/g)]
  if (eq.length) return Number(eq[eq.length - 1][1])
  const nums = [...text.matchAll(/-?\d+(?:\.\d+)?/g)]
  return nums.length ? Number(nums[nums.length - 1][0]) : null
}
