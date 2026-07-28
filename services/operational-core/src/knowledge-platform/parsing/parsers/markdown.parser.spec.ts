import { parseMarkdown } from './markdown.parser';

describe('parseMarkdown', () => {
  it('extracts the real title from the first H1 heading', () => {
    const result = parseMarkdown('# Real Title\n\nSome body text.', 'fallback');
    expect(result.title).toBe('Real Title');
  });

  it('splits real content into sections by heading, never flattening structure', () => {
    const result = parseMarkdown('# Doc\n\n## Section A\ntext a\n\n## Section B\ntext b', 'fallback');
    const headings = result.sections.map((s) => s.heading);
    expect(headings).toContain('Section A');
    expect(headings).toContain('Section B');
  });

  it('uses the fallback title when no heading exists', () => {
    const result = parseMarkdown('just plain text, no heading', 'fallback-title');
    expect(result.title).toBe('fallback-title');
  });
});
