/**
 * Question-bank QA. Runs the deterministic arithmetic verifier over every
 * seed question's explanation + hint and flags any that state an arithmetic
 * equality they provably contradict (e.g. "12 × 8 = 84").
 *
 * Precision over recall by design: it only fires on a step the parser could
 * fully evaluate AND found wrong, so flags are real — zero false positives.
 *
 * What it does NOT do (and shouldn't pretend to): detect a wrong
 * `correct_index` when the explanation's own arithmetic is internally
 * consistent (that's a semantic mis-key, not a computational error — a pure
 * arithmetic checker cannot reliably catch it from prose). Keep human review
 * for answer-key correctness.
 *
 * Run: npx tsx scripts/verify-bank.ts   (or: npm run verify:bank)
 * Exits 1 if any provably-wrong arithmetic is found (CI-usable), else 0.
 */

import { questionBank } from "./questions-bank";
import { findArithmeticErrors, fmtNum } from "../src/lib/ai/local/arithmetic-verifier";

let scanned = 0;
const flagged: string[] = [];

questionBank.forEach((q, idx) => {
  scanned++;
  const sources: { label: string; text: string }[] = [
    { label: "explanation", text: q.explanation },
    { label: "hint", text: q.hint },
  ];
  for (const { label, text } of sources) {
    const errs = findArithmeticErrors(text);
    for (const e of errs) {
      flagged.push(
        `  #${idx} [${q.topic}/${q.subtopic}/${q.difficulty}] ${label}: ` +
          `states "${e.claim}" but ${e.lhs} = ${fmtNum(e.actual)}, not ${fmtNum(e.stated)}\n` +
          `     Q: ${q.question_text.slice(0, 90)}…`,
      );
    }
  }
});

console.log(`\nQuestion-bank arithmetic QA`);
console.log(`  scanned: ${scanned} questions (explanation + hint)`);
if (flagged.length === 0) {
  console.log(
    `  ✓ no explanation contains provably-wrong arithmetic.\n` +
      `  (Note: this does not validate correct_index — keep human review for\n` +
      `   answer-key correctness; a clean run only means the worked math is\n` +
      `   internally consistent where the parser could evaluate it.)`,
  );
  process.exit(0);
}
console.log(`\n  ${flagged.length} provably-wrong step(s) found:\n`);
for (const f of flagged) console.log(f);
console.log(`\n  These are deterministic — fix the explanation arithmetic.`);
process.exit(1);
