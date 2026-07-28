// DGX Prototype 1.7.1 — real DOCX ingestion (spec §13), replacing DGX 1.7's
// documented DEFERRED stub now that a real dependency (mammoth) is
// confirmed installable and working. Headings, paragraph order, and real
// tables are preserved structurally — tables are never flattened into
// unordered prose. See docs/trusted-knowledge-pilot/docx-ingestion.md.
import * as mammoth from 'mammoth';
import { ParsedDocument } from './plain-text.parser';

export class DocxParsingFailedError extends Error {
  constructor(message: string) {
    super(`Real DOCX parsing failed: ${message}`);
    this.name = 'DocxParsingFailedError';
  }
}

const HEADING_PATTERN = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gis;
const TABLE_PATTERN = /<table[^>]*>([\s\S]*?)<\/table>/gi;
const ROW_PATTERN = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
const CELL_PATTERN = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
const TAG_PATTERN = /<[^>]+>/g;

function stripTags(html: string): string {
  return html.replace(TAG_PATTERN, ' ').replace(/\s+/g, ' ').trim();
}

function extractTables(html: string): ParsedDocument['tables'] {
  const tables: ParsedDocument['tables'] = [];
  for (const tableMatch of html.matchAll(TABLE_PATTERN)) {
    const rows = [...tableMatch[1].matchAll(ROW_PATTERN)].map((rowMatch) => [...rowMatch[1].matchAll(CELL_PATTERN)].map((cellMatch) => stripTags(cellMatch[1])));
    if (rows.length === 0) continue;
    tables.push({ headers: rows[0], rows: rows.slice(1) });
  }
  return tables;
}

// Splits the HTML into ordered sections by heading — a real, sequential
// walk (not a bag of headings), so paragraph order is preserved exactly as
// it appears in the source document.
function extractOrderedSections(htmlWithoutTables: string): ParsedDocument['sections'] {
  const headingMatches = [...htmlWithoutTables.matchAll(HEADING_PATTERN)];
  if (headingMatches.length === 0) {
    return [{ heading: null, text: stripTags(htmlWithoutTables) }];
  }

  const sections: ParsedDocument['sections'] = [];
  for (let i = 0; i < headingMatches.length; i++) {
    const current = headingMatches[i];
    const next = headingMatches[i + 1];
    const sectionEnd = next ? next.index! : htmlWithoutTables.length;
    const sectionHtml = htmlWithoutTables.slice(current.index! + current[0].length, sectionEnd);
    sections.push({ heading: stripTags(current[2]), text: stripTags(sectionHtml) });
  }
  return sections;
}

export async function parseDocx(raw: Buffer, fallbackTitle: string): Promise<ParsedDocument> {
  try {
    const result = await mammoth.convertToHtml({ buffer: raw });
    const html = result.value;

    const tables = extractTables(html);
    const htmlWithoutTables = html.replace(TABLE_PATTERN, '');
    const sections = extractOrderedSections(htmlWithoutTables);
    const bodyText = sections.map((s) => s.text).join('\n\n');
    const firstHeading = sections.find((s) => s.heading)?.heading;

    return { title: firstHeading || fallbackTitle, bodyText, sections, tables };
  } catch (err) {
    throw new DocxParsingFailedError((err as Error).message);
  }
}
