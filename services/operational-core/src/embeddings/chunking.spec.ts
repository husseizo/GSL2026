import { checksumOf, chunkText } from './chunking';

describe('chunkText', () => {
  it('packs short paragraphs into a single chunk', () => {
    const content = 'First paragraph.\n\nSecond paragraph.';
    const chunks = chunkText(content, 800);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('First paragraph.');
    expect(chunks[0]).toContain('Second paragraph.');
  });

  it('splits into multiple chunks once the max length is exceeded', () => {
    const paragraph = 'x'.repeat(500);
    const content = [paragraph, paragraph, paragraph].join('\n\n');
    const chunks = chunkText(content, 800);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(800);
    }
  });

  it('hard-slices a single paragraph longer than the max chunk size', () => {
    const paragraph = 'y'.repeat(2000);
    const chunks = chunkText(paragraph, 800);
    expect(chunks).toHaveLength(3);
    expect(chunks[0].length).toBe(800);
    expect(chunks[1].length).toBe(800);
    expect(chunks[2].length).toBe(400);
  });

  it('returns an empty array for empty content', () => {
    expect(chunkText('   \n\n  ', 800)).toEqual([]);
  });
});

describe('checksumOf', () => {
  it('is deterministic for identical text', () => {
    expect(checksumOf('same text')).toBe(checksumOf('same text'));
  });

  it('differs for different text', () => {
    expect(checksumOf('text a')).not.toBe(checksumOf('text b'));
  });
});
