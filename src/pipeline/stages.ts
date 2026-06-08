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

// Logic-domain formalization: a fenced ```smt block holding an SMT-LIB program
// the pipeline hands to the Z3 sidecar (see src/verify/logic.ts) for machine
// verification. Mirrors parseExecute's ```python handling.
export function parseSmt(text: string): string | undefined {
  return text.match(/```smt\s*([\s\S]*?)```/)?.[1]?.trim() || undefined
}
