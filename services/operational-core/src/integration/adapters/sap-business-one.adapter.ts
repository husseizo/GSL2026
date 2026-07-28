import { LegacyPartRaw } from '../handlers/part-sync.handler';
import { RawChangeBatch } from './source-adapter.interface';
import { AdapterHealth, AdapterMetadata, EnterpriseSourceAdapter } from './enterprise-source-adapter.interface';

// Real SAP Business One Service Layer REST contract: POST /b1s/v1/Login
// returns a B1SESSION cookie; entities are queried via OData-style GET with
// $filter/$orderby. This adapter has never been run against a live SAP B1
// instance (none exists in this environment) — it's tested against a local
// mock server (nock) that returns the exact response shapes SAP B1's own
// documentation specifies. Maps SAP's `Items` entity into the SAME
// LegacyPartRaw shape Phase 1's PartSyncHandler already normalizes/upserts
// from — no new entity-sync logic, only a new way to fetch and shape the
// raw records. See docs/architecture/integration-adapters.md.
export interface SapB1Config {
  baseUrl: string;
  companyDb: string;
  username: string;
  password: string;
}

interface SapB1ItemRecord {
  ItemCode: string;
  ItemName: string;
  ItmsGrpNam?: string;
  Manufacturer?: string;
  UpdateDate: string;
}

export class SapBusinessOneAdapter implements EnterpriseSourceAdapter<LegacyPartRaw> {
  readonly sourceSystem = 'SAP_BUSINESS_ONE';
  readonly entityType = 'PART' as const;

  private sessionCookie: string | null = null;

  constructor(private readonly config: SapB1Config) {}

  async authenticate(): Promise<void> {
    const res = await fetch(`${this.config.baseUrl}/b1s/v1/Login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ CompanyDB: this.config.companyDb, UserName: this.config.username, Password: this.config.password }),
    });

    if (!res.ok) {
      throw new Error(`SAP B1 login failed: ${res.status} ${await res.text()}`);
    }

    const setCookie = res.headers.get('set-cookie');
    const match = setCookie?.match(/B1SESSION=([^;]+)/);
    if (!match) throw new Error('SAP B1 login succeeded but no B1SESSION cookie was returned');
    this.sessionCookie = `B1SESSION=${match[1]}`;
  }

  async health(): Promise<AdapterHealth> {
    const started = Date.now();
    try {
      await this.authenticate();
      return { reachable: true, authenticated: true, latencyMs: Date.now() - started };
    } catch (err) {
      return { reachable: false, authenticated: false, message: (err as Error).message };
    }
  }

  async getMetadata(): Promise<AdapterMetadata> {
    return { systemName: 'SAP Business One', supportedEntities: ['PART'] };
  }

  async *fetchChanges(cursor: string | null): AsyncIterable<RawChangeBatch<LegacyPartRaw>> {
    if (!this.sessionCookie) await this.authenticate();

    const filter = cursor ? `$filter=UpdateDate ge '${cursor}'&` : '';
    const res = await fetch(`${this.config.baseUrl}/b1s/v1/Items?${filter}$orderby=UpdateDate`, {
      headers: { Cookie: this.sessionCookie! },
    });

    if (!res.ok) throw new Error(`SAP B1 Items query failed: ${res.status} ${await res.text()}`);

    const body = (await res.json()) as { value: SapB1ItemRecord[] };
    if (body.value.length === 0) return;

    yield {
      cursor: body.value[body.value.length - 1].UpdateDate,
      records: body.value.map((item) => ({
        sourceRecordId: item.ItemCode,
        operation: 'UPSERT' as const,
        sourceTimestamp: new Date(item.UpdateDate),
        payload: {
          oem_no: item.ItemCode,
          description: item.ItemName,
          brand: item.Manufacturer,
          category: item.ItmsGrpNam,
        },
      })),
    };
  }
}
