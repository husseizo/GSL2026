// DGX Prototype 1.7 — real JSON parser, zero new dependencies. Structured
// exports (e.g. a real catalogue export) parse directly, preserving
// structure rather than stringifying into ambiguous prose.
import { ParsedDocument } from './plain-text.parser';

export function parseJson(raw: string, fallbackTitle: string): ParsedDocument {
  const parsed: unknown = JSON.parse(raw);
  const title = typeof parsed === 'object' && parsed !== null && 'title' in parsed && typeof (parsed as { title: unknown }).title === 'string' ? (parsed as { title: string }).title : fallbackTitle;

  return { title, bodyText: JSON.stringify(parsed, null, 2), sections: [{ heading: null, text: JSON.stringify(parsed, null, 2) }], tables: [] };
}
