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

export async function solve(text: string, deps: SolveDeps): Promise<Scratchpad> {
  const meta = await classify(text, deps.model)
  const s = emptyScratchpad(text, meta)
  s.similar = (await deps.memory.search(text, 3)).map((t) => `Q: ${t.problem}\nA: ${t.answer}`)

  await runStages(text, s, deps.model)

  // v1 DEFERRAL (design spec §6 step 7 / §7): the spec calls for ONE re-solve
  // from Stage 1 when the LLM answer disagrees with the verified value before
  // trusting the verifier. v1 intentionally skips the re-solve: executed Python
  // is authoritative for arithmetic, so trusting it is already correct; we
  // surface the discrepancy (never silently average) rather than re-run. The
  // re-solve loop is tracked for a later sub-project.
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
