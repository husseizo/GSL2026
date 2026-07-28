# Prompt Registry

`src/prompt-registry/` — `PromptTemplate` → `PromptVersion`, versioned exactly like Phase 3's `EstimateRevision`/`JobStatusHistory`: publishing a correction never edits a previously-published version, it creates a new one and flips `isActive`.

## Append-only versioning

`PromptRegistryService.publishVersion()` runs inside a transaction: clear `isActive` on the template's current version, compute the next version number, insert the new one as active. Every `AiInferenceLog` row records the exact `promptVersionId` it used, so a historical response stays reproducible against the exact prompt text that produced it even after the template is corrected ten more times.

## Rendering

`prompt-render.ts`'s `renderPromptTemplate()` is a pure `{{variableName}}` substitution — deliberately not a templating DSL with conditionals or loops, since prompt templates are meant to be readable and auditable by a human reviewing the registry, not programmed. Missing variables are substituted with an empty string and reported back (`missingVariables`) rather than throwing, so a caller can decide whether an incomplete render is acceptable.

## Self-seeding, not manually provisioned

`RagService.ensurePromptSeeded(templateName, defaults)` checks for an active version and, if none exists, creates the template and publishes a first version with the caller-supplied defaults — used by `RagService.answer()` (`RAG_ANSWER`), `TechnicianAssistantService` (`TECHNICIAN_ASSISTANT`), and `ManagerAssistantService` (`MANAGER_ASSISTANT`). This means the system works out of the box in any environment without a manual seed script, while the resulting `PromptVersion` row is still a real, inspectable, versioned record — not a hardcoded string bypassing the registry. A human can later call `publishVersion()` to correct any of these seeded prompts through the same API, and the correction is tracked exactly like any other version bump.

## Per-purpose templates in this system

| Template name | Used by |
|---|---|
| `RAG_ANSWER` | `RagService.answer()` / `/ai/chat` |
| `TECHNICIAN_ASSISTANT` | `TechnicianAssistantService` |
| `MANAGER_ASSISTANT` | `ManagerAssistantService` |

Parts/Lubricant assistants have no prompt templates because they never call the LLM — see [rag-architecture.md](rag-architecture.md).

## APIs

`GET/POST /ai/prompts` (templates), `GET /ai/prompts/:name/versions`, `GET /ai/prompts/:name/active`, `POST /ai/prompts/:name/versions` (publish a new version) — `src/prompt-registry/prompt-registry.controller.ts`.
