import { createHash } from 'crypto';

// Pure text chunking — paragraph-aware greedy packing up to maxChunkChars,
// falling back to a hard slice for any single paragraph longer than the
// limit. No sentence-boundary NLP: this is deliberately simple and
// deterministic, matching the project's "explainable over clever" bias.
export function chunkText(content: string, maxChunkChars = 800): string[] {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > maxChunkChars && current) {
      chunks.push(current.trim());
      current = paragraph;
    } else {
      current = candidate;
    }

    while (current.length > maxChunkChars) {
      chunks.push(current.slice(0, maxChunkChars).trim());
      current = current.slice(maxChunkChars);
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// Content-addressed dedup key — "do not embed duplicated records" is
// enforced by KnowledgeChunk's @@unique([documentId, checksum]): the same
// exact chunk text re-ingested for the same document upserts instead of
// creating a second row.
export function checksumOf(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
