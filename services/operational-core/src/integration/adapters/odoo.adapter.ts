import { LegacyPartRaw } from '../handlers/part-sync.handler';
import { RawChangeBatch } from './source-adapter.interface';
import { AdapterHealth, AdapterMetadata, EnterpriseSourceAdapter } from './enterprise-source-adapter.interface';

// Real Odoo JSON-RPC 2.0 contract: POST /jsonrpc with
// {service: "common", method: "login"} to authenticate, then
// {service: "object", method: "execute_kw"} to call search_read on any
// model — here `product.template`, mapped into the same LegacyPartRaw
// shape PartSyncHandler already handles (no duplicated entity logic, see
// sap-business-one.adapter.ts for the same reuse pattern). Never run
// against a live Odoo instance (none exists in this environment) — tested
// against a local mock server (nock) matching Odoo's documented JSON-RPC
// response shapes. See docs/architecture/integration-adapters.md.
export interface OdooConfig {
  baseUrl: string;
  database: string;
  username: string;
  password: string;
}

interface OdooProductTemplate {
  id: number;
  default_code: string | false;
  name: string;
  categ_id: [number, string] | false;
  write_date: string;
}

let jsonRpcId = 1;

export class OdooAdapter implements EnterpriseSourceAdapter<LegacyPartRaw> {
  readonly sourceSystem = 'ODOO';
  readonly entityType = 'PART' as const;

  private uid: number | null = null;

  constructor(private readonly config: OdooConfig) {}

  private async call<T>(service: string, method: string, args: unknown[]): Promise<T> {
    const res = await fetch(`${this.config.baseUrl}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { service, method, args }, id: jsonRpcId++ }),
    });
    if (!res.ok) throw new Error(`Odoo JSON-RPC call failed: ${res.status} ${await res.text()}`);

    const body = (await res.json()) as { result?: T; error?: { message: string } };
    if (body.error) throw new Error(`Odoo JSON-RPC error: ${body.error.message}`);
    return body.result as T;
  }

  async authenticate(): Promise<void> {
    const uid = await this.call<number | false>('common', 'login', [this.config.database, this.config.username, this.config.password]);
    if (!uid) throw new Error('Odoo authentication failed — invalid credentials');
    this.uid = uid;
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
    return { systemName: 'Odoo', supportedEntities: ['PART'] };
  }

  async *fetchChanges(cursor: string | null): AsyncIterable<RawChangeBatch<LegacyPartRaw>> {
    if (!this.uid) await this.authenticate();

    const domain = cursor ? [['write_date', '>=', cursor]] : [];
    const records = await this.call<OdooProductTemplate[]>('object', 'execute_kw', [
      this.config.database,
      this.uid,
      this.config.password,
      'product.template',
      'search_read',
      [domain],
      { fields: ['default_code', 'name', 'categ_id', 'write_date'] },
    ]);

    if (records.length === 0) return;

    yield {
      cursor: records[records.length - 1].write_date,
      records: records
        .filter((r) => r.default_code)
        .map((r) => ({
          sourceRecordId: String(r.id),
          operation: 'UPSERT' as const,
          sourceTimestamp: new Date(r.write_date),
          payload: {
            oem_no: r.default_code as string,
            description: r.name,
            category: r.categ_id ? r.categ_id[1] : undefined,
          },
        })),
    };
  }
}
