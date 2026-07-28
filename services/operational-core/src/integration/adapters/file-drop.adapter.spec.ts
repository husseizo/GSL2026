import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileDropAdapter } from './file-drop.adapter';

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iterable) out.push(item);
  return out;
}

describe('FileDropAdapter', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aios-file-drop-'));
    await fs.writeFile(
      path.join(dir, 'batch-001.ndjson'),
      [
        JSON.stringify({ sourceRecordId: 'r1', payload: { n: 1 }, sourceTimestamp: '2026-01-01T00:00:00Z' }),
        JSON.stringify({ sourceRecordId: 'r2', payload: { n: 2 }, sourceTimestamp: '2026-01-01T00:00:00Z' }),
      ].join('\n'),
    );
    await fs.writeFile(
      path.join(dir, 'batch-002.ndjson'),
      [JSON.stringify({ sourceRecordId: 'r3', payload: { n: 3 }, sourceTimestamp: '2026-01-01T00:00:00Z' })].join(
        '\n',
      ),
    );
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('reads all files in filename order from a null cursor', async () => {
    const adapter = new FileDropAdapter('TEST', 'VEHICLE', dir, 10);
    const batches = await collect(adapter.fetchChanges(null));
    const allIds = batches.flatMap((b) => b.records.map((r) => r.sourceRecordId));
    expect(allIds).toEqual(['r1', 'r2', 'r3']);
  });

  it('resumes from the persisted cursor instead of re-reading earlier lines', async () => {
    const adapter = new FileDropAdapter('TEST', 'VEHICLE', dir, 10);
    // Cursor says "already processed line 0 of batch-001.ndjson" (i.e. r1 done).
    const batches = await collect(adapter.fetchChanges('batch-001.ndjson:1'));
    const allIds = batches.flatMap((b) => b.records.map((r) => r.sourceRecordId));
    expect(allIds).toEqual(['r2', 'r3']);
  });

  it('emits a cursor per batch that encodes file and next line index', async () => {
    const adapter = new FileDropAdapter('TEST', 'VEHICLE', dir, 10);
    const batches = await collect(adapter.fetchChanges(null));
    expect(batches.map((b) => b.cursor)).toEqual(['batch-001.ndjson:2', 'batch-002.ndjson:1']);
  });
});
