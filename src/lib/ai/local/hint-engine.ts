/**
 * One-line cognitive nudge — picks the most relevant pointer
 * for the question's subtopic without revealing the answer.
 */

const NUDGES: Record<string, string[]> = {
  Arithmetic: [
    "Which base are you applying that percentage to?",
    "Have you preserved the unit you started with?",
    "What changes if you replace your numbers with simple ones (10, 100)?",
  ],
  Algebra: [
    "What does the discriminant tell you here?",
    "Did you check whether your root satisfies the original equation (no extraneous solutions)?",
    "Combine before you exponentiate — does that simplify it?",
  ],
  Geometry: [
    "Have you drawn or labelled every length you know?",
    "Is there an auxiliary line that creates a known right triangle?",
    "What symmetry could halve this problem?",
  ],
  "Modern Math": [
    "Are these arrangements ordered or unordered?",
    "Are you double-counting indistinguishable cases?",
    "What changes if items repeat versus all distinct?",
  ],
  "Reading Comprehension": [
    "What is the author's pivot word — the place where the stance flips?",
    "Which option restates the author's claim, not just the topic?",
    "Is the option you picked supported by the passage, or merely consistent with it?",
  ],
  "Sentence Correction": [
    "Strip to subject-verb-object — does the verb still agree?",
    "Where is the modifier sitting, and what does it actually modify?",
    "Is the parallel structure intact across the conjunctions?",
  ],
  "Para Jumbles": [
    "Which sentence introduces the topic without leaning on a pronoun?",
    "Where are the pivot cues — 'yet', 'but', 'however'?",
    "Which two sentences are causally linked — and in which order?",
  ],
  Arrangements: [
    "What is the strongest single-fix clue?",
    "Does 'between' here mean adjacent, or just somewhere in between?",
    "Have you used every clue at least once?",
  ],
  Puzzles: [
    "What's invariant in this problem?",
    "Is there a parity argument you can use?",
    "What's the smallest number of moves any solution requires?",
  ],
};

export function localHint(payload: { topic: string; subtopic: string; currentReasoning: string }) {
  const list = NUDGES[payload.subtopic] ?? [
    "Re-read the question and identify the one constraint you haven't used yet.",
    "If you can't name the principle in one sentence, the chain isn't ready.",
  ];
  // Rotate based on a stable hash of the reasoning so it doesn't always say the same thing.
  const idx = simpleHash(payload.currentReasoning) % list.length;
  return list[idx];
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
