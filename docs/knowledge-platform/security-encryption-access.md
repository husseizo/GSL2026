# Encryption at Rest & Access Control

> **Update — DGX Prototype 1.7.1.** The "not yet wired in" limitation below is resolved. See [`docs/trusted-knowledge-pilot/encryption-at-rest.md`](../trusted-knowledge-pilot/encryption-at-rest.md) for the real, wired-in key-rotation implementation, verified via a real plaintext-absence round-trip test. 3 real `KnowledgeItemVersion` rows carry a populated `encryptionKeyId` this pilot (the sections below describe the DGX 1.7 state before this wiring existed).

## Encryption adapter — real, but not yet wired into the ingestion path (as of DGX 1.7; see update above)

`encryptRawSourceBytes()`/`decryptRawSourceBytes()` (`src/knowledge-platform/security/file-encryption-adapter.ts`) are a thin, real `Buffer↔base64` adapter over the existing, unmodified `src/common/crypto/field-encryption.ts` (AES-256-GCM, `ENCRYPTION_KEY`-derived) — the same self-describing `iv.authTag.ciphertext` format already used for MFA secrets. `KnowledgeItemVersion.encryptedRawSource String?` exists on the schema as the intended storage column.

**Honest limitation, confirmed by grep, as of DGX 1.7**: neither function is called anywhere outside its own test — no real call site in `IngestionPipelineService` or `KnowledgeItemRegistryService` populates `encryptedRawSource` yet. The adapter is real and unit-tested in isolation; wiring it into the actual ingest/publish path (encrypting the original source bytes before they reach `rawContent`, for sources whose license terms require it) is not done this phase. Named here rather than implied complete.

## Access control — real, enforced today

`KnowledgeSource.accessClassification`, `allowedInternalUse`, `allowedAiUse`, `allowedEmbeddingUse`, `allowedQuotationUse`, `redistributionRestrictions` are real fields enforced at two points:

1. **Publish-eligibility gate** (`assertPublishEligible()`, see `source-registry.md`) — an unlicensed non-`INTERNAL_WORKSHOP` source can never reach `PUBLISHED`.
2. **AI-consumer retrieval** (`searchKnowledge()`, see `retrieval-and-ai-consumer-contract.md`) — a `RESTRICTED` source with `allowedAiUse: false` is excluded from every AI-consumer result, even if its content was somehow published.

Both are verified end-to-end by the verify script (steps 8–10, 33) with a real, persisted `RESTRICTED` source fixture.

## Explicitly deferred as of DGX 1.7 — now real (DGX Prototype 1.7.1)

Malware/antivirus scanning of ingested documents and OCR are no longer deferred. See [`docs/trusted-knowledge-pilot/malware-scanning.md`](../trusted-knowledge-pilot/malware-scanning.md) and [`docs/trusted-knowledge-pilot/ocr-policy.md`](../trusted-knowledge-pilot/ocr-policy.md) for the real implementations, including the honest limitation that no local ClamAV binary is available in this sandbox (a real, working adapter exists and correctly reports this rather than claiming full AV coverage).
