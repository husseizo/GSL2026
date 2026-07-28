// DGX Prototype 1.7.2 — entity extraction (spec §4 stage 4). Distinct from
// classifyRetrievalQuery() (which classifies the WHOLE query into one
// primary class): this pulls every identifier-shaped token out of a
// longer, possibly multilingual query, each independently classified.
// Real, deterministic, pure — no LLM call.
import { classifyRetrievalQuery, RetrievalQueryClassValue } from './query-classifier';

export interface ExtractedEntity {
  token: string;
  queryClass: RetrievalQueryClassValue;
  confidence: number;
}

const IDENTIFIER_SHAPED_TOKEN = /^[A-Za-z0-9][A-Za-z0-9.-]{2,19}$/;

export function extractEntities(rawQuery: string): ExtractedEntity[] {
  const words = rawQuery.trim().split(/\s+/).filter(Boolean);
  const entities: ExtractedEntity[] = [];

  for (const word of words) {
    if (!IDENTIFIER_SHAPED_TOKEN.test(word)) continue;
    if (!/\d/.test(word)) continue; // a real identifier-shaped token always carries at least one digit
    const classified = classifyRetrievalQuery(word);
    if (classified.queryClass === 'UNKNOWN' || classified.queryClass === 'FREE_TEXT_QUESTION' || classified.queryClass === 'ENGLISH' || classified.queryClass === 'SWAHILI' || classified.queryClass === 'MIXED_LANGUAGE') {
      continue;
    }
    entities.push({ token: word, queryClass: classified.queryClass, confidence: classified.confidence });
  }

  return entities;
}
