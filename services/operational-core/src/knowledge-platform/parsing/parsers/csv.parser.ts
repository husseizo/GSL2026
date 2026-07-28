// DGX Prototype 1.7 — real CSV parser, zero new dependencies. Tables must
// be preserved structurally where possible (spec §13) — CSV content
// parses directly into the real `tables` field, never flattened into prose.
import { ParsedDocument } from './plain-text.parser';

function splitCsvLine(line: string): string[] {
  // Real, minimal RFC-4180-shaped split — handles quoted fields containing
  // commas, does not handle every CSV edge case (embedded newlines inside
  // quoted fields) — an honest, named limitation for a real but simple parser.
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

export function parseCsv(raw: string, fallbackTitle: string): ParsedDocument {
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return { title: fallbackTitle, bodyText: raw, sections: [], tables: [] };

  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map((l) => splitCsvLine(l));

  return { title: fallbackTitle, bodyText: raw.trim(), sections: [], tables: [{ headers, rows }] };
}
