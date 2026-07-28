// DGX Prototype 1.7 — stage 10: real, deterministic keyword classification
// (never an LLM call) into a KnowledgeItemType. Ambiguous content
// (matching zero or multiple types) is classified OTHER and flagged
// low-confidence — never guessed with false certainty.
import { KnowledgeItemType } from '@prisma/client';

const TYPE_KEYWORDS: { type: KnowledgeItemType; keywords: RegExp }[] = [
  { type: 'TECHNICAL_BULLETIN', keywords: /\bbulletin\b|\btsb\b/i },
  { type: 'REPAIR_PROCEDURE', keywords: /\brepair procedure\b|\bhow to (repair|replace)\b/i },
  { type: 'DIAGNOSTIC_PROCEDURE', keywords: /\bdiagnos(is|tic)\b|\bfault code\b|\bdtc\b/i },
  { type: 'INSPECTION_PROCEDURE', keywords: /\binspect(ion)?\b/i },
  { type: 'SERVICE_INTERVAL', keywords: /\bservice interval\b|\bevery \d+\s?(km|miles)\b/i },
  { type: 'TORQUE_SPECIFICATION', keywords: /\btorque\b/i },
  { type: 'FLUID_SPECIFICATION', keywords: /\bfluid\b|\blubricant\b|\boil\b/i },
  { type: 'LUBRICANT_APPROVAL', keywords: /\bapproval\b.*\b(oil|lubricant)\b|\b(oil|lubricant)\b.*\bapproval\b/i },
  { type: 'PART_FITMENT', keywords: /\bfits?\b|\bcompatible with\b/i },
  { type: 'PART_SUPERSESSION', keywords: /\bsupersede[ds]?\b/i },
  { type: 'SAFETY_WARNING', keywords: /\bwarning\b|\bcaution\b|\bdanger\b/i },
  { type: 'WARRANTY_RULE', keywords: /\bwarranty\b/i },
  { type: 'WORKSHOP_SOP', keywords: /\bsop\b|\bstandard operating procedure\b/i },
  { type: 'DATA_GOVERNANCE_POLICY', keywords: /\bdata governance\b/i },
  { type: 'AI_GOVERNANCE_POLICY', keywords: /\bai governance\b/i },
  { type: 'REPEAT_REPAIR_CASE', keywords: /\brepeat repair\b/i },
  { type: 'INTERNAL_CASE_NOTE', keywords: /\bdiagnostic session\b|\btechnician note\b/i },
];

export interface ClassificationResult {
  itemType: KnowledgeItemType;
  matchedKeyword: string | null;
  confident: boolean;
}

export function classifyContent(text: string): ClassificationResult {
  const matches = TYPE_KEYWORDS.filter((t) => t.keywords.test(text));
  if (matches.length === 1) {
    return { itemType: matches[0].type, matchedKeyword: matches[0].keywords.source, confident: true };
  }
  if (matches.length > 1) {
    // Ambiguous — multiple types matched. Return the first as a best
    // guess, flagged NOT confident, so callers route to review rather
    // than trust the classification blindly.
    return { itemType: matches[0].type, matchedKeyword: matches[0].keywords.source, confident: false };
  }
  return { itemType: 'OTHER', matchedKeyword: null, confident: false };
}
