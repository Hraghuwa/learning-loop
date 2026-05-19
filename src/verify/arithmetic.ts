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
