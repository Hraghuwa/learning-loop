import Anthropic from "@anthropic-ai/sdk";

const ANALYZE_MODEL = "claude-sonnet-4-6";
const HINT_MODEL = "claude-haiku-4-5-20251001";

const systemPrompt = `You are Learning Loop's Cognitive Diagnostician — an elite CAT exam mentor with the pattern-recognition of someone who has reviewed 100,000 student attempts.

Your job is NOT to grade right/wrong. Your job is to surface the THINKING PATTERN behind a student's answer, regardless of whether they got it correct.

Diagnostic principles:
1. A correct answer with sloppy reasoning is a future failure. Flag it.
2. An incorrect answer with sound reasoning is a near-miss. Encourage it.
3. Generic feedback ("review the topic") is useless. Be surgical: name the specific cognitive move that went wrong (e.g., "you eliminated B before checking it satisfied constraint 2").
4. Always end with a forward path. The student must know exactly what to drill next.
5. Tone: brilliant mentor, never harsh, never patronizing. Editorial precision.

Scoring rubric for reasoningScore (0-10):
- 0-2: No reasoning or pure guess.
- 3-4: Surface-level reasoning, named the topic but no logic chain.
- 5-6: Partial logic, missed a constraint or made an unjustified leap.
- 7-8: Sound logic with a small gap (arithmetic, edge case, terminology).
- 9-10: Crisp, complete reasoning even if final answer was wrong.

Error type taxonomy (pick ONE that best fits):
- Conceptual Gap: foundational misunderstanding of the topic.
- Calculation Error: method right, arithmetic/algebra slip.
- Misread Question: missed a constraint, condition, or qualifier in the stem.
- Shortcut Missed: brute-forced where a known shortcut applies.
- Assumption Error: leapt to an unjustified inference.
- No Reasoning Provided: reasoning was empty or non-substantive.
- Correct Reasoning: logic chain is sound (use even if answer wrong if reasoning was sound).`;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function analyzeReasoning(payload: {
  questionText: string;
  topic: string;
  subtopic: string;
  options: string[];
  correctIndex: number;
  selectedIndex: number;
  reasoning: string;
}) {
  const letters = ["A", "B", "C", "D"];
  const isCorrect = payload.correctIndex === payload.selectedIndex;
  const userPrompt = `TOPIC: ${payload.topic} / ${payload.subtopic}
QUESTION: ${payload.questionText}
OPTIONS:
  A) ${payload.options[0]}
  B) ${payload.options[1]}
  C) ${payload.options[2]}
  D) ${payload.options[3]}
CORRECT ANSWER: ${letters[payload.correctIndex]}) ${payload.options[payload.correctIndex]}
STUDENT CHOSE: ${letters[payload.selectedIndex]}) ${payload.options[payload.selectedIndex]}
RESULT: ${isCorrect ? "CORRECT" : "INCORRECT"}

STUDENT'S REASONING (verbatim): "${payload.reasoning}"

Diagnose the cognitive pattern. Respond ONLY with valid minified JSON, no markdown:
{
  "errorType": "Conceptual Gap | Calculation Error | Misread Question | Shortcut Missed | Assumption Error | No Reasoning Provided | Correct Reasoning",
  "diagnosis": "2-3 sentences naming the SPECIFIC thinking move that helped or hurt them. Quote phrases from their reasoning when useful.",
  "correction": "3-4 sentences. Walk them through the correct cognitive sequence, not the answer. End with the constraint or step they should anchor on next time.",
  "reasoningScore": 0-10 integer per the rubric,
  "patternAlert": "One-sentence label naming a recurring habit to watch (e.g., 'Locking in before constraint check'), or null if this attempt was clean.",
  "nextPracticeTopic": "Specific subtopic to drill next, e.g., 'Quantitative / Time-Speed-Distance with relative motion'."
}`;

  const response = await client.messages.create({
    model: ANALYZE_MODEL,
    max_tokens: 800,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const firstText = response.content.find((x) => x.type === "text");
  return firstText?.type === "text" ? firstText.text : "{}";
}

export async function generateHint(payload: {
  questionText: string;
  topic: string;
  subtopic: string;
  currentReasoning: string;
}) {
  const system = `You are Learning Loop's CAT coach. Provide a single "Cognitive Nudge" — a hint that redirects the student's attention without revealing the answer.

Rules:
- Never state the correct option or compute the final value.
- Identify ONE constraint, definition, or step they appear to be skipping.
- Phrase as a question or pointer, not a solution.
- Under 50 words. No preamble. No "Great question!". Just the nudge.`;

  const user = `TOPIC: ${payload.topic} / ${payload.subtopic}
QUESTION: ${payload.questionText}
STUDENT'S CURRENT REASONING: "${payload.currentReasoning}"

Give the nudge.`;

  const message = await client.messages.create({
    model: HINT_MODEL,
    max_tokens: 200,
    system,
    messages: [{ role: "user", content: user }],
  });
  const block = message.content.find((x) => x.type === "text");
  return block?.type === "text" ? block.text.trim() : "Re-read the question and check which constraint you haven't used yet.";
}
