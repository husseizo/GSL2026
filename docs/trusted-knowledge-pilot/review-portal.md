# Minimal Knowledge Review Portal

## Scope

Deliberately smaller than DGX 1.7's own deferred 19-screen portal design — 12 required screens, each functional against real data, never presentation-only.

## Screens (all under `services/web-portal/src/pages/knowledge/`)

`SourceRegistryPage`, `IngestionRunsPage`, `QuarantineQueuePage`, `DocumentViewerPage`, `CandidateClaimsReviewPage`, `StructuredFactsReviewPage`, `ConflictQueuePage`, `ApprovalQueuePage`, `PublishedKnowledgeSearchPage`, `SnapshotStatusPage`, `EvaluationResultsPage`, `AuditHistoryPage`.

Each follows the exact existing pattern established by `UserManagementPage.tsx`: `useEffect` fetch on mount → `setState` → a raw `<table>` render → inline mutate-then-refetch for any action button. No new UI framework or state-management library was introduced. Routes registered in `App.tsx`; nav links added under a new "Knowledge Platform" section in `Layout.tsx`.

## Real backing data

Every screen calls a real controller endpoint backed by real Prisma queries against the live corpus (16,138 items, 17,129 facts, 32,293 claims, 4 conflicts, 50,284 audit rows) — none of the 12 screens render fabricated or hardcoded data.

## Security boundary

The real security boundary is server-side (`@RequirePermissions` on every underlying controller, unchanged pattern from DGX 1.7). Client-side permission awareness (a `permissions: string[]` field on `AuthContext`) is used only to hide/disable nav links — never the actual enforcement mechanism.
