# Core Data Model

Scope note: this file specifies the **full target model** (all modules from the spec) at design level. Fields marked `[P1]` are implemented in Phase 1 code (`services/operational-core`). Everything else is design-only until its phase lands — see [04-roadmap.md](04-roadmap.md).

## 1. Sync envelope (embedded in every synced entity) `[P1]`

Every table that originates in an external source system embeds these columns (see `SyncMeta` in the Prisma schema):

| Field | Purpose |
|---|---|
| `sourceSystem` | which upstream system this record came from (e.g. `LEGACY_POS`, `LEGACY_ERP`) |
| `sourceRecordId` | primary key in the source system |
| `externalId` | stable business identifier if different from the source PK (e.g. VIN, OEM number) |
| `syncedAt` | last time the integration layer wrote this record |
| `recordVersion` | monotonic version from the source, or synthetic increment if source has none |
| `checksum` | hash of the source payload, used to detect no-op syncs and skip writes |
| `createdAt` / `updatedAt` | AIOS-local timestamps |
| `syncStatus` | `PENDING \| SYNCED \| CONFLICT \| ERROR` |
| `syncError` | last error detail, nullable |

A record with no `sourceSystem` is native to AIOS (created directly, e.g. a manual vehicle entry or a merge-approved parts master row).

## 2. Vehicle master `[P1: core fields]`

Canonical, one row per physical vehicle, resolved primarily by VIN.

- Identity: VIN/chassis `[P1]`, registration number `[P1]`, brand/model/variant/model year `[P1]`, production date, market spec
- Powertrain: engine code `[P1]`, engine family `[P1]`, displacement, fuel type, powertrain type, transmission code, drive type, body type
- History (append-only, each row timestamped + sourced): mileage readings, ownership changes, service visits, repair jobs, DTC history, installed-part history, lubricant history, warranty events, recall/TSB references
- Derived/AI-populated (Phase 3+, always flagged as `predicted` not `actual`): last visit, next expected service, predicted maintenance needs, risk score
- **Decode confidence**: every decoded field (from VIN or registration lookup) stores a `confidence: EXACT | HIGH | MEDIUM | LOW | UNVERIFIED` and a `decodeSource`. Manual correction is always allowed and always writes to `VehicleAttributeHistory` rather than overwriting silently `[P1]`.

### VehicleAttributeHistory `[P1]`
Append-only: `vehicleId, field, oldValue, newValue, changedBy, changedAt, reason, confidence`.

## 3. Parts master `[P1: core fields]`

- Identity: internal item code `[P1]`, OEM number `[P1]`, alternate OEM numbers `[P1]`, manufacturer number, brand
- Description: product name, **standardized product name** (normalized, see matching below) `[P1]`
- Classification: category, subcategory, movement classification (fast/medium/slow/dead — computed, Phase 4 analytics)
- Compatibility: vehicle compatibility, engine compatibility, transmission compatibility (many-to-many join tables) `[P1: schema only]`
- Lineage: superseded numbers, replacement numbers, cross references `[P1: schema]`
- Commercial: cost, selling prices, price lists, margin, warranty period (Phase 2, needs pricing module)
- Stock (Phase 2, needs inventory module): current/reserved/available/incoming, reorder point, safety stock, lead time, MOQ, package qty
- Scores (Phase 4, computed by analytics/AI, never hand-entered): demand score, criticality score, dead-stock score, return rate, failure rate
- Relations: images, technical documents, installation notes, commonly-paired parts (Phase 3, market-basket analysis), associated fault codes, associated garage services

### Deduplication / matching `[P1: matching pipeline, no auto-merge]`
Two-stage: (1) deterministic rule-based match on normalized OEM number + brand + checked cross-reference tables; (2) embedding similarity over standardized description + compatibility overlap for candidates the rule stage doesn't resolve. Both stages only ever produce a `PartMatchCandidate` row with a score and rationale — **nothing merges without a human approving the candidate** via the merge-review queue.

## 4. Lubricants master (Phase 2, design only for now)

Same shape as parts master but with lubricant-specific attributes: viscosity, OEM approvals, API/ACEA classification, service interval, fill quantity, batch/expiry. Recommendation logic must select only from `approved` compatibility rows — an LLM is never allowed to assert a specification/approval that isn't in this table (see [03-ai-platform.md](03-ai-platform.md) §2).

## 5. Garage workflow entities (Phase 3, design only)

JobCard → JobCardLine, InspectionChecklist, DiagnosticScan/DTC, TechnicianNote, LabourOperation, RequiredPart, RequiredLubricant, Estimate, CustomerApproval, WorkOrder, QCChecklist, RoadTestResult, CompletionReport, WarrantyRecord. Status enum exactly as enumerated in the spec (Draft → ... → Completed/Cancelled/Warranty return), with stage-entry/exit timestamps captured on every transition for delay-cause analysis (missing parts / technician availability / customer approval / supplier delay / diagnostic uncertainty / payment delay / outsourced work).

## 6. Analytics warehouse (Phase 4, design only)

Star schema fed from the operational DB by scheduled/CDC ETL, never written to directly by applications.

**Facts**: FactSales, FactSalesLines, FactGarageJobs, FactGarageJobLines, FactPartsUsage, FactLubricantUsage, FactPurchases, FactInventoryMovements, FactStockSnapshots, FactCustomerVisits, FactVehicleVisits, FactDiagnosticCodes, FactSearchEvents, FactAppEvents, FactSupplierPerformance, FactReturns, FactWarrantyClaims, FactLostSales, FactQuotes, FactPayments.

**Dimensions**: DimDate, DimTime, DimCustomer, DimVehicle, DimVIN, DimBrand, DimModel, DimModelYear, DimEngine, DimTransmission, DimPart, DimPartCategory, DimLubricant, DimSupplier, DimBranch, DimWarehouse, DimEmployee, DimSalesperson, DimTechnician, DimServiceType, DimFaultCode, DimJobStatus, DimPurchaseStatus, DimCustomerSegment.

Grain and SCD-type per dimension is a Phase 4 design task — flagged here so Phase 1 table design doesn't foreclose it (e.g. vehicle/part IDs are stable surrogate keys, never reused).
