import { SourceAdapter } from './source-adapter.interface';

// Extends Phase 1's SourceAdapter (fetchChanges only) with the concerns an
// enterprise ERP connection needs that a file-drop feed doesn't: proving
// it's actually reachable and authenticated, and describing itself. Sync,
// retry, checkpointing, and dead-lettering are NOT re-implemented here —
// those already exist, generically, in IntegrationService.runSync() (see
// docs/architecture/integration-adapters.md for exactly which spec §5
// requirement maps to which existing piece of machinery vs. what's new
// here).
export interface AdapterHealth {
  reachable: boolean;
  authenticated: boolean;
  latencyMs?: number;
  message?: string;
}

export interface AdapterMetadata {
  systemName: string;
  version?: string;
  supportedEntities: string[];
}

export interface EnterpriseSourceAdapter<TRaw = unknown> extends SourceAdapter<TRaw> {
  health(): Promise<AdapterHealth>;
  authenticate(): Promise<void>;
  getMetadata(): Promise<AdapterMetadata>;
}
