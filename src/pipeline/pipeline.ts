import { ModelPort } from '@/model/types'
import { MemoryPort } from '@/memory/types'
import { classify } from '@/classifier/classifier'
import { emptyScratchpad, Scratchpad } from './scratchpad'
import { STAGE_NAMES, buildStagePrompt, parseExecute, parseSmt } from './stages'
import { verifyArithmetic } from '@/verify/arithmetic'
import { verifyLogic } from '@/verify/logic'
import { verifyVerbal } from '@/verify/verbal'
import { majorityVote } from '@/consistency/vote'

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
    // Any stage may formalize the problem as SMT-LIB; the last one wins so a
    // later stage can refine an earlier formalization.
    const smt = parseSmt(out)
    if (smt) s.smt = smt
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

// ONE re-solve pass for an arithmetic LLM/verifier disagreement. Outcomes:
//   confirmed  — re-executed code reproduces the verified value → trust it
//                fully (confidence 100), discrepancy resolved.
//   corrected  — re-executed code agrees with the LLM's original prose answer
//                → the first formalization was the bug; adopt the new value
//                at confidence 85.
//   unresolved — no usable code, execution failed, or a third value appeared
//                → keep the first executed value, keep the discrepancy, drop
//                confidence to 90 (executed, but unconverged).
async function resolveArithmeticDiscrepancy(
  s: Scratchpad, firstValue: string, model: ModelPort
): Promise<void> {
  const out = await model.complete([{ role: 'user', content:
`You are APEX-REASON re-checking an arithmetic disagreement.
PROBLEM:
${s.problem}

Your step-by-step reasoning concluded "ANSWER: ${s.llmAnswer}", but your executed python code printed "${firstValue}". Exactly one of these is wrong.

Re-derive the solution from scratch, carefully. OUTPUT a fenced \`\`\`python\`\`\` block that prints the answer, then a line "ANSWER: <value>".` }],
    { temperature: 0 })
  s.stages['resolve'] = out

  const { code } = parseExecute(out)
  const re = code ? await verifyArithmetic(code) : undefined
  const reValue = re?.ok ? re.value?.trim() : undefined

  if (reValue !== undefined && reValue === firstValue.trim()) {
    s.confidence = 100
    s.resolution = `re-solve confirmed the verified value "${firstValue}" (prose answer "${s.llmAnswer}" was wrong)`
    s.discrepancy = undefined
  } else if (reValue !== undefined && s.llmAnswer && reValue === s.llmAnswer.trim()) {
    s.verifiedAnswer = reValue
    s.confidence = 85
    s.resolution = `re-solve corrected the computation: first code printed "${firstValue}" but re-derived code agrees with the original answer "${reValue}"`
    s.discrepancy = undefined
  } else {
    s.confidence = 90
  }
}

export async function solve(text: string, deps: SolveDeps): Promise<Scratchpad> {
  const meta = await classify(text, deps.model)
  const s = emptyScratchpad(text, meta)
  s.similar = (await deps.memory.search(text, 3)).map((t) => `Q: ${t.problem}\nA: ${t.answer}`)

  await runStages(text, s, deps.model)

  // Arithmetic: executed Python is authoritative. When the LLM's prose answer
  // disagrees with the executed value, run EXACTLY ONE re-solve (design spec
  // §6 step 7): show the model both values, ask for fresh code, execute it,
  // and reconcile. The verified value always comes from executed code — the
  // re-solve only decides WHICH execution to trust and how confident to be.
  if (meta.domain === 'arithmetic' && s.computation) {
    const r = await verifyArithmetic(s.computation)
    if (r.ok && r.value !== undefined) {
      s.verifiedAnswer = r.value
      s.verifyState = 'verified'
      s.confidence = 100
      if (s.llmAnswer && s.llmAnswer.trim() !== r.value.trim()) {
        s.discrepancy = `LLM answered "${s.llmAnswer}" but verified value is "${r.value}"`
        await resolveArithmeticDiscrepancy(s, r.value, deps.model)
      }
    } else {
      s.verifyState = 'best-effort'
      s.confidence = 25
      s.discrepancy = `arithmetic verification failed: ${r.error ?? 'unknown'}`
    }
  } else if (meta.domain === 'logic' && s.smt) {
    // Logic-domain machine verification (Z3 via src/verify/sidecar.py). Only a
    // UNIQUELY satisfying model counts as verified: `sat` from the sidecar means
    // the constraints + answer admit exactly one model. `multiple` (more than
    // one model) and `unsat`/`error` stay best-effort so we never falsely claim
    // a logic answer is proven.
    const r = await verifyLogic(s.smt)
    if (r.status === 'sat' && r.solution !== undefined) {
      s.verifiedAnswer = r.solution
      s.verifyState = 'verified'
      s.confidence = 100
      if (s.llmAnswer && !r.solution.includes(s.llmAnswer.trim())) {
        s.discrepancy = `LLM answered "${s.llmAnswer}" but the unique satisfying model is ${r.solution}`
      }
    } else if (r.status === 'multiple') {
      s.verifyState = 'best-effort'
      s.confidence = 40
      s.discrepancy = 'logic constraints admit multiple satisfying models; not uniquely verified'
    } else {
      s.verifyState = 'best-effort'
      s.confidence = 25
      s.discrepancy = `logic verification failed: ${r.status}${r.error ? ` (${r.error})` : ''}`
    }
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

  // Verbal-domain soft check: LLM entailment of the answer against the source.
  // This is a judgement, not a formal proof, so it only MODULATES confidence —
  // verbal stays 'best-effort' (honesty invariant: only executed Python / Z3
  // produce 'verified'). Self-consistency already chose the winner above.
  if (meta.domain === 'verbal' && s.verifiedAnswer) {
    const v = await verifyVerbal(s.verifiedAnswer, text, deps.model)
    if (v.entailment === 'entail') {
      s.confidence = Math.min(95, 50 + Math.round(v.confidence * 0.45))
    } else if (v.entailment === 'contradict') {
      s.confidence = Math.max(5, Math.round(v.confidence * 0.2))
      s.discrepancy = `verbal entailment: answer appears to contradict the source (model confidence ${v.confidence})`
    } else {
      s.confidence = 35
    }
  }

  const finalAnswer = s.verifiedAnswer ?? s.llmAnswer ?? ''
  await deps.memory.write({ problem: text, meta, answer: finalAnswer, output: s.stages['articulation'] ?? '' })
  return s
}
