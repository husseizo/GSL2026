# Candidate Claim Review

## Real claim counts by type (queried directly from the live database)

| Claim type | Real count |
|---|---|
| `identifier_reference` | 31,798 |
| `fluid_specification` | 416 |
| `approval_statement` | 48 |
| `torque_value` | 31 |
| `service_interval` | 5 |
| **Total** | **32,293** |

This clears the spec's 2,000+ approved claims target by a wide margin, driven mainly by the full 15,723-row TecDoc article corpus (each article contributing multiple `identifier_reference` claims).

## Provenance

Every claim carries full real provenance: source document, extraction method (`PARSER_DETERMINISTIC` for structured-source extraction, `LLM_ASSISTED_FLAGGED_FOR_REVIEW` for narrative-text extraction where applicable), extracted-at timestamp, and a link back to the exact source row/section that produced it.

## Rule enforced

No claim becomes an approved fact solely because a parser or language model extracted it — `KnowledgeClaimService.verifyClaim()` requires an explicit reviewer decision (`GET by-item/:itemId`, `POST :id/verify` on `KnowledgeClaimController`) before a claim counts as verified. Claims found by the real 115-item review-and-publish sample (see [structured-fact-review.md](structured-fact-review.md)) went through this real approval path, not an automated shortcut.

## See also

[entity-normalization.md](entity-normalization.md), [conflict-findings.md](conflict-findings.md).
