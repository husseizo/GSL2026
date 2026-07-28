// DGX Prototype 1.7 — real parser, zero new dependencies (spec §12-13).
export interface ParsedDocument {
  title: string;
  bodyText: string;
  sections: { heading: string | null; text: string; page?: number }[];
  tables: { headers: string[]; rows: string[][] }[];
  // DGX Prototype 1.7.1 — real OCR fallback metadata (spec §14), populated
  // only by pdf.parser.ts when native text extraction yields near-empty
  // content. Undefined for every other format.
  ocrApplied?: boolean;
  ocrConfidence?: number;
}

export function parsePlainText(raw: string, fallbackTitle: string): ParsedDocument {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const title = lines[0]?.trim() || fallbackTitle;
  return { title, bodyText: raw.trim(), sections: [{ heading: null, text: raw.trim() }], tables: [] };
}
