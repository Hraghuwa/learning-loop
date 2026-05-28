/**
 * Concept extraction primitives — used by the local cognitive engine.
 *
 * No ML. Just well-tested heuristics.
 */

const STOPWORDS = new Set([
  "the","a","an","and","or","but","if","then","so","because","since","as","of","to","in","on","at","by","for","with","from",
  "is","are","was","were","be","been","being","this","that","these","those","it","its","they","them","their","there","here",
  "i","you","he","she","we","my","your","his","her","our","us","me","him","its","do","does","did","not","no","yes",
  "have","has","had","will","would","can","could","should","may","might","must","shall",
  "than","too","very","just","also","only","such","like","some","any","all","both","each","few","more","most","other","same",
  "into","over","out","up","down","off","on","again","further","once","here","when","where","why","how","what","who","which",
  "really","actually","probably","maybe","i'd","i'll","i'm","it's","that's","there's","wasn't","won't","don't","can't",
  "got","get","gets","getting","go","goes","going","done","take","takes","taken","know","knows","known","think","thinks",
  "thought","thinking","because","reason","reasoning","question","option","answer","problem","try","tried","need","needed",
]);

const DOMAIN_TERMS = new Set([
  // quant — arithmetic
  "ratio","percent","percentage","profit","loss","interest","compound","simple","speed","distance","time","rate","work","pipe","fill","drain","mixture","alligation","alcohol","water","average","mean","median","mode",
  // quant — algebra
  "equation","quadratic","linear","root","discriminant","factor","factorize","expand","logarithm","log","exponent","exponential","polynomial","coefficient","term","sum","series","arithmetic","geometric","progression","ap","gp",
  // quant — geometry
  "triangle","circle","square","rectangle","polygon","angle","perpendicular","parallel","diameter","radius","chord","tangent","arc","sector","cone","cylinder","sphere","cube","prism","area","perimeter","volume",
  // quant — modern math
  "permutation","combination","probability","factorial","arrangement","selection","stars","bars","integer",
  // varc
  "passage","author","tone","argument","stance","inference","claim","evidence","metaphor","irony","conclusion","premise","topic","main","central","primary","support","weaken","strengthen",
  // dilr
  "constraint","arrangement","sequence","row","column","circular","facing","seat","puzzle","logic","grid","truth","liar",
  // generic logic
  "constraint","condition","therefore","hence","thus","because","since","implies","contradicts","verify","check","eliminate","substitute","equate","calculate","compute",
]);

const LOGIC_MARKERS = {
  causal: ["because","since","therefore","hence","thus","so","implies","leads","follows","accordingly","consequently"],
  verification: ["verify","check","confirm","double-check","re-read","reread","substitute","plug","plug in","plug-in","test","sanity"],
  constraints: ["constraint","condition","given","must","cannot","at least","at most","exactly","only","unless","provided","integer","positive","negative","non-negative","real"],
  hedging: ["maybe","perhaps","probably","might","could","i think","i guess","not sure","unsure","seem","seems","seemed","i feel"],
  elimination: ["eliminate","rule out","cross out","skip","reject","not a","not b","not c","not d","wrong because","incorrect because"],
};

const NUMERIC_RE = /-?\d+(\.\d+)?/g;
const OPERATOR_RE = /[+\-*/=<>≤≥%^]/;

export type ReasoningSignals = {
  wordCount: number;
  sentences: number;
  domainTerms: string[];
  conceptTokens: Set<string>;
  conceptOverlap: number;
  hasCausal: boolean;
  hasVerification: boolean;
  hasConstraintTalk: boolean;
  hasHedging: boolean;
  hasElimination: boolean;
  numericContent: number;
  operatorContent: boolean;
  matchedExplanationPhrases: string[];
};

export function extractSignals(reasoning: string, question: { questionText: string; explanation: string | null; subtopic: string }) {
  const text = reasoning.trim();
  const tokens = tokenize(text);
  const conceptTokens = new Set<string>();
  for (const t of tokens) if (!STOPWORDS.has(t) && t.length > 1) conceptTokens.add(t);

  const explanationTokens = explanationConcepts(question.explanation, question.questionText);

  // Jaccard-ish overlap weighted by domain terms.
  let overlapHits = 0;
  let domainHits = 0;
  for (const tok of conceptTokens) {
    if (explanationTokens.has(tok)) overlapHits++;
    if (DOMAIN_TERMS.has(tok)) domainHits++;
  }
  const denom = Math.max(1, Math.min(20, explanationTokens.size));
  const conceptOverlap = Math.min(1, overlapHits / denom);

  const lowerText = text.toLowerCase();
  const hasMarker = (markers: string[]) => markers.some((m) => lowerText.includes(m));

  const matchedPhrases: string[] = [];
  if (question.explanation) {
    const phrases = phraseSegments(question.explanation, 4);
    for (const p of phrases) {
      if (p.length > 6 && lowerText.includes(p)) matchedPhrases.push(p);
    }
  }

  return {
    wordCount: tokens.length,
    sentences: Math.max(1, (text.match(/[.!?]+/g) || []).length),
    domainTerms: Array.from(conceptTokens).filter((t) => DOMAIN_TERMS.has(t)).slice(0, 8),
    conceptTokens,
    conceptOverlap,
    hasCausal: hasMarker(LOGIC_MARKERS.causal),
    hasVerification: hasMarker(LOGIC_MARKERS.verification),
    hasConstraintTalk: hasMarker(LOGIC_MARKERS.constraints) || domainHits >= 2,
    hasHedging: hasMarker(LOGIC_MARKERS.hedging),
    hasElimination: hasMarker(LOGIC_MARKERS.elimination),
    numericContent: ((text.match(NUMERIC_RE) || []).length),
    operatorContent: OPERATOR_RE.test(text),
    matchedExplanationPhrases: matchedPhrases.slice(0, 4),
  } satisfies ReasoningSignals;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function explanationConcepts(explanation: string | null, fallback: string): Set<string> {
  const source = explanation && explanation.length > 30 ? explanation : fallback;
  const tokens = tokenize(source);
  const set = new Set<string>();
  for (const t of tokens) {
    if (STOPWORDS.has(t)) continue;
    if (t.length < 3 && !/\d/.test(t)) continue;
    set.add(t);
  }
  return set;
}

function phraseSegments(text: string, n: number): string[] {
  const sanitized = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i + n <= sanitized.length; i++) {
    out.push(sanitized.slice(i, i + n).join(" "));
  }
  return out;
}
