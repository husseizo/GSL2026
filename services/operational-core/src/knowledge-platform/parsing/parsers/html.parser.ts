// DGX Prototype 1.7 — real HTML parser: basic tag-stripping + heading
// structure extraction. No headless browser, no JS execution — this is
// a real, deliberate constraint (an ingested HTML document is untrusted
// content; never executed, only text-extracted). Zero new dependencies.
import { ParsedDocument } from './plain-text.parser';

const HEADING_TAG_PATTERN = /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gis;
const TITLE_TAG_PATTERN = /<title[^>]*>(.*?)<\/title>/is;
const TAG_PATTERN = /<[^>]+>/g;

function stripTags(html: string): string {
  return html
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(TAG_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseHtml(raw: string, fallbackTitle: string): ParsedDocument {
  const titleMatch = raw.match(TITLE_TAG_PATTERN);
  const title = titleMatch ? stripTags(titleMatch[1]) : fallbackTitle;

  const headings = [...raw.matchAll(HEADING_TAG_PATTERN)].map((m) => stripTags(m[1]));
  const bodyText = stripTags(raw);

  const sections = headings.length > 0 ? headings.map((h) => ({ heading: h, text: bodyText })) : [{ heading: null, text: bodyText }];

  return { title, bodyText, sections, tables: [] };
}
