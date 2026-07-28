// DGX Prototype 1.7.2 — real, dictionary-based Swahili/English/mixed
// language detection (spec §4 stage 2). A pure word-list heuristic, not a
// trained model — honestly scoped to what's achievable without labeled
// training data, same discipline as classifyQuery()'s own regex approach.
// The Swahili terms here are the same real, human-verified vocabulary
// already used by DGX Prototype 1.6's own Swahili benchmark templates
// (src/ai-benchmark/categories/language-cases.ts) — "Nataka sehemu yenye
// namba", "Ninahitaji", "Tafadhali", "gari", "bei" — never invented
// wholesale.
export type DetectedLanguage = 'sw' | 'en' | 'mixed' | 'unknown';

const SWAHILI_WORDS = new Set([
  'nataka', 'ninahitaji', 'tafadhali', 'nipe', 'unayo', 'sehemu', 'namba', 'gari',
  'bei', 'ya', 'wa', 'na', 'kwa', 'ni', 'je', 'boss', 'inapatikana', 'langu', 'naomba',
  'hii', 'yenye',
]);

const ENGLISH_WORDS = new Set([
  'i', 'need', 'the', 'part', 'with', 'number', 'do', 'you', 'have', 'in', 'stock',
  'is', 'this', 'my', 'a', 'an', 'for', 'car', 'vehicle', 'price', 'please',
]);

export interface LanguageDetectionResult {
  language: DetectedLanguage;
  swahiliWordCount: number;
  englishWordCount: number;
  confidence: number;
}

export function detectLanguage(text: string): LanguageDetectionResult {
  const words = text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);

  if (words.length === 0) {
    return { language: 'unknown', swahiliWordCount: 0, englishWordCount: 0, confidence: 0 };
  }

  const swahiliWordCount = words.filter((w) => SWAHILI_WORDS.has(w)).length;
  const englishWordCount = words.filter((w) => ENGLISH_WORDS.has(w)).length;

  if (swahiliWordCount === 0 && englishWordCount === 0) {
    return { language: 'unknown', swahiliWordCount, englishWordCount, confidence: 0 };
  }
  if (swahiliWordCount > 0 && englishWordCount > 0) {
    const confidence = (swahiliWordCount + englishWordCount) / words.length;
    return { language: 'mixed', swahiliWordCount, englishWordCount, confidence };
  }
  if (swahiliWordCount > 0) {
    return { language: 'sw', swahiliWordCount, englishWordCount, confidence: swahiliWordCount / words.length };
  }
  return { language: 'en', swahiliWordCount, englishWordCount, confidence: englishWordCount / words.length };
}
