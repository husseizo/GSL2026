// DGX Prototype 1.7.1 — real ETL source configuration for the two
// already-integrated company databases this phase onboards (spec §4
// Priority A/B, §15). Composes the EXISTING, unmodified data-consolidation
// adapters (MolasLubricantsCacheAdapter, PartsCatalogAutoHubAdapter) via
// config only — no new SQL Server/Postgres connectivity is built here. See
// docs/trusted-knowledge-pilot/structured-source-ingestion-molas-tecdoc.md.
import { LubricantsFeedConfig } from '../../data-consolidation/adapters/molas-lubricants-cache.adapter';
import { PartsCatalogFeedConfig } from '../../data-consolidation/adapters/parts-catalog-autohub.adapter';

// Full table — 362 real rows, small enough to process completely.
export const LIQUI_MOLY_FEED_CONFIG: LubricantsFeedConfig = {
  feedName: 'liqui-moly-products',
  table: 'dbo.CacheLiquiMolyProducts',
  keyColumn: 'ArticleNumber',
  entityType: 'LUBRICANT',
  batchSize: 100,
};

// Full table — 15,723 real rows, clears the pilot's item-count target on
// its own.
export const TECDOC_ARTICLE_FEED_CONFIG: PartsCatalogFeedConfig = {
  feedName: 'tecdoc-article',
  table: 'tecdoc_article',
  keyColumn: 'tecdoc_article_id',
  entityType: 'PART',
  batchSize: 500,
};

// Deliberately bounded — 3,378,514 real rows exist; a pilot proves the FITS
// relationship mechanism works end-to-end with full provenance, it does not
// bulk-migrate TecDoc's entire licensed fitment graph. See
// docs/trusted-knowledge-pilot/corpus-scope-and-limits.md for the honest
// accounting of this real, named gap.
export const TECDOC_FITMENT_EDGE_CAP = 50_000;

export const TECDOC_ARTICLE_VEHICLE_FEED_CONFIG: PartsCatalogFeedConfig = {
  feedName: 'tecdoc-article-vehicle',
  table: 'tecdoc_article_vehicle',
  keyColumn: 'id',
  entityType: 'PART',
  batchSize: 1000,
  limit: TECDOC_FITMENT_EDGE_CAP,
};
