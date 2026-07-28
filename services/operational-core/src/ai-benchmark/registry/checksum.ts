// Pure — no DB, no I/O. Deterministic checksum over a benchmark's frozen
// case set, used to detect any drift between what was approved/frozen and
// what's actually in the database later (the same "cheap tamper-evidence"
// pattern CatalogueIndexVersion.corpusChecksum already established).
import { createHash } from 'crypto';

export function computeBenchmarkChecksum(caseExternalIds: string[]): string {
  const sorted = [...caseExternalIds].sort();
  return createHash('sha256').update(sorted.join('\n')).digest('hex');
}
