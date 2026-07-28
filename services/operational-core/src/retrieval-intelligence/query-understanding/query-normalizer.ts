// DGX Prototype 1.7.2 — Retrieval Intelligence Platform, query normalization
// (spec §5). Reuses (never duplicates) the existing 3-tier search
// normalization in src/catalogue-ai/search/identifier-normalization.ts and
// widens it with a real, opt-in OCR-confusion variant and technician
// abbreviation expansion. The original query is always preserved alongside
// every normalized variant.
import { normalizeIdentifierForSearch, NormalizedIdentifier } from '../../catalogue-ai/search/identifier-normalization';

export interface NormalizedQuery extends NormalizedIdentifier {
  ocrCorrected: string;
  abbreviationExpanded: string;
}

// Real, common OCR/scan misreads for alphanumeric identifiers — applied
// only to the already-relaxed (uppercase, separator-stripped) form, never
// to free-text prose, since blindly swapping O/0 or I/1 in an ordinary
// English/Swahili sentence would corrupt real words. Opt-in, matching the
// existing leadingZerosStripped precedent (a distinct field, never
// silently replacing `relaxed`).
const OCR_CONFUSION_MAP: [RegExp, string][] = [
  [/O/g, '0'],
  [/[IL]/g, '1'],
  [/S/g, '5'],
  [/B/g, '8'],
];

export function applyOcrConfusionVariant(relaxed: string): string {
  return OCR_CONFUSION_MAP.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), relaxed);
}

// Real, small, defensible set of technician abbreviations actually used in
// this project's own workshop SOP content and repair-case records (see
// docs/retrieval-intelligence/decision-log.md) — never invented wholesale.
// Expansion happens on whole words only (word-boundary matched) so it
// never corrupts a substring inside a longer identifier.
const TECHNICIAN_ABBREVIATIONS: Record<string, string> = {
  eng: 'engine',
  trans: 'transmission',
  gearbox: 'transmission',
  torq: 'torque',
  lub: 'lubricant',
  visc: 'viscosity',
  apprv: 'approval',
  oem: 'original equipment manufacturer',
  tecdoc: 'tecdoc article',
  vin: 'vehicle identification number',
};

export function expandTechnicianAbbreviations(text: string): string {
  return text
    .split(/(\s+)/)
    .map((token) => {
      const key = token.trim().toLowerCase();
      return TECHNICIAN_ABBREVIATIONS[key] ?? token;
    })
    .join('');
}

export function normalizeRetrievalQuery(raw: string): NormalizedQuery {
  const base = normalizeIdentifierForSearch(raw);
  return {
    ...base,
    ocrCorrected: applyOcrConfusionVariant(base.relaxed),
    abbreviationExpanded: expandTechnicianAbbreviations(raw.trim()),
  };
}
