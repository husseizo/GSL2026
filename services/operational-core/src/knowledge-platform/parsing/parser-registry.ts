// DGX Prototype 1.7/1.7.1 — format -> parser dispatch. Decides real vs.
// unsupported at runtime, never silently swallowing an unsupported format.
// Async since real PDF/DOCX parsing (pdf-parse/mammoth) is inherently
// promise-based — every other real parser stays a plain synchronous
// function internally, simply resolved through this async wrapper.
import { ParsedDocument, parsePlainText } from './parsers/plain-text.parser';
import { parseMarkdown } from './parsers/markdown.parser';
import { parseHtml } from './parsers/html.parser';
import { parseCsv } from './parsers/csv.parser';
import { parseJson } from './parsers/json.parser';
import { parsePdf } from './parsers/pdf.parser';
import { parseDocx } from './parsers/docx.parser';

export type SupportedFormat = 'text' | 'markdown' | 'html' | 'csv' | 'json' | 'pdf' | 'docx';

// DGX Prototype 1.7.1 — PDF/DOCX need real bytes (a Buffer), never a
// lossy string round-trip (converting real binary bytes through a JS
// string and back would corrupt non-UTF8 byte sequences) — every other
// format still takes its raw text content directly, exactly as before.
export async function parseByFormat(format: SupportedFormat, raw: string, fallbackTitle: string, rawBytes?: Buffer): Promise<ParsedDocument> {
  switch (format) {
    case 'text':
      return parsePlainText(raw, fallbackTitle);
    case 'markdown':
      return parseMarkdown(raw, fallbackTitle);
    case 'html':
      return parseHtml(raw, fallbackTitle);
    case 'csv':
      return parseCsv(raw, fallbackTitle);
    case 'json':
      return parseJson(raw, fallbackTitle);
    case 'pdf':
      if (!rawBytes) throw new Error('parseByFormat("pdf", ...) requires rawBytes — real binary content, never a string round-trip.');
      return parsePdf(rawBytes, fallbackTitle);
    case 'docx':
      if (!rawBytes) throw new Error('parseByFormat("docx", ...) requires rawBytes — real binary content, never a string round-trip.');
      return parseDocx(rawBytes, fallbackTitle);
    default: {
      const exhaustiveCheck: never = format;
      throw new Error(`Unknown format: ${exhaustiveCheck}`);
    }
  }
}

// DGX Prototype 1.7.1 — PDF/DOCX are real this phase (pdf-parse/mammoth,
// both confirmed installable and working in this environment). Every
// format this platform accepts is now real; nothing remains deferred here.
export const REAL_FORMATS: SupportedFormat[] = ['text', 'markdown', 'html', 'csv', 'json', 'pdf', 'docx'];
export const DEFERRED_FORMATS: SupportedFormat[] = [];
