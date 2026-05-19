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
