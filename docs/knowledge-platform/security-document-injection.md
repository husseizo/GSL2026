# Document-Ingestion Prompt-Injection Defense

`scanDocumentForInjection()` (`src/knowledge-platform/security/document-injection-scanner.ts`) is a materially different threat model from the two existing chat-facing defenses already in this codebase:

- `src/ai-gateway/prompt-sanitizer.ts` — short, single-utterance, human-authored chat prompts, flag-only.
- `src/catalogue-ai/rag/query-understanding.ts`'s `PROMPT_INJECTION_PATTERNS` — a hard-refusal classifier gate for live queries.

Ingested **documents** are multi-page, the injection text can be buried anywhere, and a genuine technical bulletin should never contain these phrases at all — so this scanner takes a stricter block/quarantine posture and reports **where** each flagged phrase occurred (label + matched text + character offset), not just a boolean.

## Real patterns (10)

`ignore_previous_instructions`, `reveal_system_prompt`, `execute_command`, `query_database`, `change_system_behaviour`, `call_external_url`, `override_policy`, `modify_knowledge`, `auto_approve_this_document`, `mark_as_verified`.

Any match ⇒ `quarantined: true` — a hard block, not a warning. `IngestionPipelineService.ingest()` stops entirely on a match: no `KnowledgeItemVersion` is created, and the finding is audit-logged (`KNOWLEDGE_INGESTION_QUARANTINED`). Verified end-to-end by the verify script: a fixture containing a literal injected-instruction phrase is quarantined (step 15), and legitimate technical content with only numbers/units is confirmed **not** falsely quarantined (step 16).

## Honest limitation

Regex-based, the same shape as `PROMPT_INJECTION_PATTERNS` — real gaps exist against phrasings outside this fixed pattern list. Not claimed complete.

## A real, unrelated lint fix along the way

The control-character-stripping regex in this file trips ESLint's `no-control-regex` rule (a legitimate, intentional pattern). Fixed with the same scoped `eslint-disable-next-line` the existing `prompt-sanitizer.ts` already uses for the identical case — not a rule change.
