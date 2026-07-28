import { compressPayload, decompressPayload } from './compression';

describe('compression', () => {
  it('round-trips a JSON payload through real gzip compression', () => {
    const original = JSON.stringify({ jobId: '123', lines: Array.from({ length: 50 }, (_, i) => ({ id: i, part: 'Ignition Coil' })) });
    const compressed = compressPayload(original);
    expect(decompressPayload(compressed)).toBe(original);
  });

  it('actually shrinks a repetitive payload (real compression, not a no-op)', () => {
    const original = JSON.stringify({ data: 'x'.repeat(10_000) });
    const compressed = compressPayload(original);
    expect(compressed.length).toBeLessThan(Buffer.byteLength(original, 'utf8') / 10);
  });
});
