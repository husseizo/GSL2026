import { PrismaService } from '../prisma/prisma.service';
import { RawChangeBatch, SourceAdapter, SyncCursor } from './adapters/source-adapter.interface';
import { EntitySyncHandler, ValidationResult } from './entity-sync-handler.interface';
import { IntegrationService } from './integration.service';

interface FakeRaw {
  value?: string;
  invalid?: boolean;
  throwOnNormalize?: boolean;
}

class FakeAdapter implements SourceAdapter<FakeRaw> {
  readonly sourceSystem = 'TEST_SOURCE';
  readonly entityType = 'VEHICLE' as const;
  constructor(private readonly batches: RawChangeBatch<FakeRaw>[]) {}

  async *fetchChanges(_cursor: SyncCursor): AsyncIterable<RawChangeBatch<FakeRaw>> {
    for (const batch of this.batches) {
      yield batch;
    }
  }
}

// A handler backed by an in-memory map instead of Prisma, so idempotency
// (checksum-skip) can be exercised across two real runSync() calls without a
// database — mirrors exactly what VehicleSyncHandler does against Postgres.
class InMemoryHandler implements EntitySyncHandler<FakeRaw, { value: string }> {
  readonly entityType = 'VEHICLE' as const;
  readonly checksumStore = new Map<string, string>();
  readonly upserted: Array<{ sourceRecordId: string; value: string }> = [];

  validate(raw: FakeRaw): ValidationResult {
    return raw.invalid ? { valid: false, error: 'marked invalid by test fixture' } : { valid: true };
  }

  normalize(raw: FakeRaw): { value: string } {
    if (raw.throwOnNormalize) throw new Error('normalize failed');
    return { value: raw.value! };
  }

  checksum(normalized: { value: string }): string {
    return normalized.value;
  }

  async getExistingChecksum(_sourceSystem: string, sourceRecordId: string): Promise<string | null> {
    return this.checksumStore.get(sourceRecordId) ?? null;
  }

  async upsert(params: {
    sourceRecordId: string;
    checksum: string;
    normalized: { value: string };
  }): Promise<void> {
    if (params.normalized.value === 'FAIL_UPSERT') {
      throw new Error('simulated db error');
    }
    this.checksumStore.set(params.sourceRecordId, params.checksum);
    this.upserted.push({ sourceRecordId: params.sourceRecordId, value: params.normalized.value });
  }
}

describe('IntegrationService', () => {
  let prisma: {
    integrationSource: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    syncRun: { create: jest.Mock; update: jest.Mock };
    syncDeadLetter: { upsert: jest.Mock };
  };
  let service: IntegrationService;

  beforeEach(() => {
    prisma = {
      integrationSource: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'source-1', lastCommittedCursor: null }),
        update: jest.fn(),
      },
      syncRun: {
        create: jest.fn().mockResolvedValue({ id: 'run-1' }),
        update: jest.fn(),
      },
      syncDeadLetter: { upsert: jest.fn() },
    };
    service = new IntegrationService(prisma as unknown as PrismaService);
  });

  it('upserts valid records, dead-letters failures at each stage, and skips deletes', async () => {
    const handler = new InMemoryHandler();
    const adapter = new FakeAdapter([
      {
        cursor: 'batch-1',
        records: [
          { sourceRecordId: 'v1', operation: 'UPSERT', payload: { value: 'A' }, sourceTimestamp: new Date() },
          { sourceRecordId: 'v2', operation: 'UPSERT', payload: { invalid: true }, sourceTimestamp: new Date() },
          {
            sourceRecordId: 'v3',
            operation: 'UPSERT',
            payload: { throwOnNormalize: true },
            sourceTimestamp: new Date(),
          },
          {
            sourceRecordId: 'v4',
            operation: 'UPSERT',
            payload: { value: 'FAIL_UPSERT' },
            sourceTimestamp: new Date(),
          },
          { sourceRecordId: 'v5', operation: 'DELETE', payload: {}, sourceTimestamp: new Date() },
        ],
      },
    ]);

    const summary = await service.runSync(adapter, handler);

    expect(summary).toMatchObject({
      recordsFetched: 5,
      recordsUpserted: 1,
      recordsSkipped: 1, // the DELETE
      recordsFailed: 3, // invalid, normalize-throw, upsert-throw
      status: 'COMPLETED',
    });
    expect(handler.upserted).toEqual([{ sourceRecordId: 'v1', value: 'A' }]);
    expect(prisma.syncDeadLetter.upsert).toHaveBeenCalledTimes(3);

    const stages = prisma.syncDeadLetter.upsert.mock.calls.map((call) => call[0].create.stage);
    expect(stages).toEqual(['VALIDATE', 'NORMALIZE', 'UPSERT']);
  });

  it('skips a no-op replay of an already-synced record (idempotency)', async () => {
    const handler = new InMemoryHandler();
    const record = {
      sourceRecordId: 'v1',
      operation: 'UPSERT' as const,
      payload: { value: 'A' },
      sourceTimestamp: new Date(),
    };

    const firstRun = await service.runSync(new FakeAdapter([{ cursor: 'c1', records: [record] }]), handler);
    expect(firstRun.recordsUpserted).toBe(1);

    // Simulate a crash-and-replay: same record served again from the same cursor.
    const secondRun = await service.runSync(new FakeAdapter([{ cursor: 'c1', records: [record] }]), handler);

    expect(secondRun.recordsUpserted).toBe(0);
    expect(secondRun.recordsSkipped).toBe(1);
    expect(handler.upserted).toHaveLength(1); // still only written once
  });
});
