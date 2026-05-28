/**
 * Assertion harness for the local arithmetic verifier.
 * Run: npx tsx scripts/verify-arithmetic.ts   (or: npm run verify:arith)
 * Exit code 1 on any failure. No test framework / no new deps.
 */

import {
  safeEval,
  findArithmeticErrors,
  extractFinalNumber,
  fmtNum,
} from "../src/lib/ai/local/arithmetic-verifier";

let passed = 0;
let failed = 0;

function eq(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL  ${name}\n  got : ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`);
  }
}

// ---- safeEval: arithmetic correctness ----
eq("add", safeEval("2 + 3"), 5);
eq("precedence", safeEval("2 + 3 * 4"), 14);
eq("parens", safeEval("(2 + 3) * 4"), 20);
eq("unary minus", safeEval("-5 + 2"), -3);
eq("decimals", safeEval("140 * 0.75"), 105);
eq("power right-assoc", safeEval("2 ^ 3 ^ 2"), 512);
eq("unicode times/div/minus", safeEval("72 ÷ 7"), 72 / 7);
eq("unicode minus sign", safeEval("10 − 4"), 6);

// ---- safeEval: honesty contract (refuse the ambiguous/unsafe) ----
eq("reject letters", safeEval("2 + x"), null);
eq("reject empty", safeEval("   "), null);
eq("reject trailing garbage", safeEval("2 + 3 foo"), null);
eq("reject bad number", safeEval("1.2.3 + 1"), null);
eq("reject div by zero", safeEval("5 / 0"), null);
eq("no code execution", safeEval("process.exit(1)"), null);

// ---- findArithmeticErrors: catches a real slip, ignores correct steps ----
eq(
  "catches wrong product",
  findArithmeticErrors("First 12 * 8 = 84, then add 5."),
  [{ claim: "12 * 8 = 84", lhs: "12 * 8", stated: 84, actual: 96 }],
);
eq("ignores correct step", findArithmeticErrors("So 140 × 0.75 = 105 hence profit 5%."), []);
eq("rounding is tolerated", findArithmeticErrors("Thus 72/7 = 10.29 minutes."), []);
eq("skips unparseable claims", findArithmeticErrors("Let x = 5 so area = pi r^2."), []);
eq(
  "multi-error, capped",
  findArithmeticErrors("2*2=5 and 3*3=10 and 4*4=20").length,
  3,
);
// regression: chained equality / fraction must NOT false-flag
eq("no false flag on fraction rhs", findArithmeticErrors("probability = 6/21 = 2/7"), []);
eq(
  "no false flag mid-chain expression",
  findArithmeticErrors("Total = 60 + 20 + 1 = 81"),
  [],
);
eq(
  "still catches a real isolated slip after the fix",
  findArithmeticErrors("Step: 12 * 8 = 84.").length,
  1,
);

// ---- extractFinalNumber (bank QA helper) ----
eq("final = value", extractFinalNumber("CP=100, MP=140. SP = 140 × 0.75 = 105. Profit = 5%."), 5);
eq("final approx value", extractFinalNumber("Rate = 7/72. Time = 72/7 ≈ 10.29 min."), 10.29);
eq("fallback last number", extractFinalNumber("The answer is 42 marbles"), 42);

// ---- fmtNum ----
eq("fmt int", fmtNum(96), "96");
eq("fmt decimal", fmtNum(10.285714), "10.286");

// ---- integration: diagnosis-engine wire-in ----
import { localDiagnose } from "../src/lib/ai/local/diagnosis-engine";

const quantBase = {
  questionText: "A shopkeeper marks goods 40% above cost, 25% discount. Profit %?",
  topic: "Quantitative",
  subtopic: "Arithmetic",
  options: ["5%", "10%", "15%", "20%"],
  correctIndex: 0,
  selectedIndex: 1,
  explanation: "CP=100, MP=140, SP=140×0.75=105, profit 5%.",
};

const wrong = localDiagnose({
  ...quantBase,
  reasoning: "CP 100, MP 140. Discounted SP: 140 * 0.75 = 110. So profit 10%.",
});
eq("verified slip → Calculation Error", wrong.errorType, "Calculation Error");
eq("diagnosis quotes the wrong claim", wrong.diagnosis.includes("140 * 0.75"), true);
eq("diagnosis states the correct value (105)", wrong.diagnosis.includes("105"), true);
eq("verified finding is high-confidence", wrong.confidence >= 0.92, true);

const noMath = localDiagnose({
  ...quantBase,
  reasoning: "I eliminated A and D, then picked B because it felt closest.",
});
eq(
  "no provable slip → engine stays inert (no fabricated 'Verified' text)",
  noMath.diagnosis.includes("Verified arithmetic slip"),
  false,
);

const verbal = localDiagnose({
  questionText: "Pick the word closest to 'abundant'.",
  topic: "VARC",
  subtopic: "Vocabulary",
  options: ["scarce", "plentiful", "hidden", "fragile"],
  correctIndex: 1,
  selectedIndex: 0,
  explanation: "abundant ≈ plentiful.",
  reasoning: "Honestly I guessed, maybe 2*2=5 logic, scarce sounded right.",
});
eq(
  "non-quant topic never runs the arithmetic verifier",
  verbal.diagnosis.includes("Verified arithmetic slip"),
  false,
);

console.log(`\narithmetic-verifier: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
