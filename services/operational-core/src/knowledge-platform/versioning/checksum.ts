// Pure — no DB, no I/O. Real content checksum for a KnowledgeItemVersion's
// rawContent — used for duplicate detection (identical checksum => no new
// version needed) and version-change detection (same key, different
// checksum => a new version). Same real sha256 pattern as
// src/ai-benchmark/registry/checksum.ts.
import { createHash } from 'crypto';

export function computeContentChecksum(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
