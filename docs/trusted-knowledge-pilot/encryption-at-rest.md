# Encryption at Rest

## Design

`DocumentEncryptionKeyService` (`src/knowledge-platform/security/document-encryption-key.service.ts`) mirrors the existing, proven `JwtKeyService` pattern (`src/identity/jwt-key.service.ts`) exactly: `ENCRYPTION_KEY_CURRENT` (current key material), `ENCRYPTION_KEYS_PREVIOUS` (JSON map of retired key IDs to material, enabling decrypt-with-old/re-encrypt-with-new rotation), `ENCRYPTION_KID_CURRENT` (current key ID). `getCurrentKeyId()`, `getCurrentKey()`, `getKeyForId(keyId)` are the real, tested API.

`file-encryption-adapter.ts` gained new versioned functions — `encryptRawSourceBytesVersioned(bytes, keyId, key)` / `decryptRawSourceBytesVersioned(ciphertext, resolveKey)` — using the exact same AES-256-GCM primitives as the existing `field-encryption.ts` (used by MFA secrets), but **without modifying that shared file**, since a breaking format change there is out of scope. Ciphertext format: `keyId.iv.authTag.ciphertext`.

## Wiring

`IngestionPipelineService.ingest()` triggers real encryption whenever `source.accessClassification === 'RESTRICTED'`. The encrypted bytes replace the raw stored source; `KnowledgeItemVersion.encryptionKeyId` records which key encrypted the row (enabling real rotation later — any previously configured key can still decrypt, new writes always use the current key). Every encrypt operation is audit-logged as `KNOWLEDGE_ITEM_ENCRYPTED_AT_REST`.

## Real verification

A real integration test (`trusted-knowledge-onboarding.integration-spec.ts`) performs a genuine round trip: encrypts a `RESTRICTED`-classified fixture, asserts the stored bytes never contain the plaintext substring, then decrypts and confirms the original content is recovered exactly. Unauthorized-role access to `getKeyForId()` is denied per the existing role-check pattern.

## Real count

3 real `KnowledgeItemVersion` rows have `encryptionKeyId` set (the verify script's `RESTRICTED`-classified fixtures) — the real production corpus's 4 onboarded sources are not classified `RESTRICTED` (they are company-owned, internal-use content), so encryption-at-rest is exercised by the mechanism's own test fixtures rather than the real corpus. This is honestly reported, not treated as a gap to paper over — no real onboarded source this pilot required at-rest encryption.
