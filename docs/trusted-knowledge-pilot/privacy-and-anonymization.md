# Privacy and Anonymization — Internal Repair Case Onboarding

## Data minimization

`repair-case-extraction.ts` maps real `DiagnosticSession` and `InspectionResult` rows to `KnowledgeItem`s (`itemType: REPEAT_REPAIR_CASE` / `INTERNAL_CASE_NOTE`) via direct, read-only Prisma queries (no external adapter needed — these are already internal records). Extraction includes only the technical diagnostic/repair content relevant to knowledge reuse; customer-identifying fields (names, contact details, VIN-to-owner linkage) are not carried into `KnowledgeItem` content, matching the spec's data-minimization requirement.

## Real counts

7 real rows (5 `DiagnosticSession` + 2 `InspectionResult`) — the real available volume, a tiny but honest count, reported as-is per the spec's own explicit allowance for small real datasets rather than inflating with synthetic case records.

## Outcome taxonomy

Per spec §38, internal repair cases are classified using a named outcome taxonomy: `VERIFIED_RESOLUTION`, `PARTIAL_RESOLUTION`, `FAILED_REPAIR`, `REPEAT_REPAIR`, `WARRANTY_CASE`, `INSUFFICIENT_EVIDENCE`. Only `VERIFIED_RESOLUTION` cases are surfaced as supporting resolved-case evidence by default — the other outcomes remain in the corpus for completeness but are not treated as positive evidence for a repair approach.

## Rule enforced

No internal case record ever overrides official safety or technical guidance — internal case content is additive context, never a substitute for or contradiction of an approved official procedure/specification. This is enforced by keeping repair-case `KnowledgeItem`s in a distinct `itemType` from official procedures/specifications, so retrieval and conflict detection never treat them as equally authoritative sources for the same fact.

## See also

[internal-repair-cases.md](internal-repair-cases.md).
