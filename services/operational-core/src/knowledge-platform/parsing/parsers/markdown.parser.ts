// DGX Prototype 1.7 — real Markdown parser, zero new dependencies. Real
// heading-based section extraction (do not flatten structure into
// ambiguous prose, spec §13) using plain string/regex parsing, the same
// zero-dependency-parsing precedent as src/embeddings/chunking.ts.
import { ParsedDocument } from './plain-text.parser';

const HEADING_PATTERN = /^(#{1,6})\s+(.+)$/;

export function parseMarkdown(raw: string, fallbackTitle: string): ParsedDocument {
  const lines = raw.split(/\r?\n/);
  const sections: { heading: string | null; text: string }[] = [];
  let currentHeading: string | null = null;
  let currentText: string[] = [];
  let title = fallbackTitle;
  let sawFirstHeading = false;

  for (const line of lines) {
    const match = line.match(HEADING_PATTERN);
    if (match) {
      if (currentText.length > 0 || currentHeading) {
        sections.push({ heading: currentHeading, text: currentText.join('\n').trim() });
      }
      currentHeading = match[2].trim();
      currentText = [];
      if (!sawFirstHeading && match[1].length === 1) {
        title = currentHeading;
        sawFirstHeading = true;
      }
    } else {
      currentText.push(line);
    }
  }
  if (currentText.length > 0 || currentHeading) {
    sections.push({ heading: currentHeading, text: currentText.join('\n').trim() });
  }

  return { title, bodyText: raw.trim(), sections: sections.filter((s) => s.text.length > 0 || s.heading), tables: [] };
}
