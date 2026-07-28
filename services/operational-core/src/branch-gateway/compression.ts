import { gunzipSync, gzipSync } from 'zlib';

// Real gzip compression for bandwidth-constrained branch links — not a
// placeholder. compressPayload()/decompressPayload() round-trip through
// Node's real zlib bindings. See docs/architecture/branch-gateway.md.
export function compressPayload(json: string): Buffer {
  return gzipSync(Buffer.from(json, 'utf8'));
}

export function decompressPayload(compressed: Buffer): string {
  return gunzipSync(compressed).toString('utf8');
}
