# Architecture Documentation

## Start here

**[AIOS_FOUNDATION_ARCHITECTURE_SPECIFICATION_V1.md](AIOS_FOUNDATION_ARCHITECTURE_SPECIFICATION_V1.md)** — read this before writing any AIOS code, regardless of which phase or module you are touching. It is the permanent constitution of the platform: why AIOS exists, its five architectural layers, the role of DGX, the permanent contracts that must survive any framework/model/database change, the architectural invariants, and the rules for building new capability layers on top of the certified AI Foundation.

Every other document in this directory, and in the phase-specific `docs/` subdirectories (`docs/retrieval-intelligence/`, `docs/knowledge-platform/`, `docs/ai-evaluation/`, `docs/ai-foundation-certification/`, etc.), describes a specific phase's implementation. The Foundation Architecture Specification is the one document that explains why those phases exist and what they must never violate.

## Phase and subsystem documents

- [00-overview.md](00-overview.md) — Foundation phase overview.
- [01-data-model.md](01-data-model.md) — Core data model.
- [02-integration-contracts.md](02-integration-contracts.md) — Integration contracts.
- [03-ai-platform.md](03-ai-platform.md) — Early AI platform design.
- [04-roadmap.md](04-roadmap.md) — Roadmap.
- [phase-2-commercial-foundation.md](phase-2-commercial-foundation.md), [garage-architecture.md](garage-architecture.md), [phase5-decision-log.md](phase5-decision-log.md) — subsequent phase decision logs.
- [dgx-platform.md](dgx-platform.md), [rag-architecture.md](rag-architecture.md), [vector-search.md](vector-search.md), [model-registry.md](model-registry.md), [prompt-registry.md](prompt-registry.md) — AI-platform-specific design docs (implementation detail; read the Foundation Specification first for why these exist).
- [identity-platform.md](identity-platform.md), [authorization.md](authorization.md), [rbac-permissions.md](rbac-permissions.md), [security-production.md](security-production.md), [security-dgx.md](security-dgx.md) — security and authorization detail.
- [evaluation-framework.md](evaluation-framework.md) — the Evaluation Framework's own design doc (see also `docs/ai-evaluation/` and `docs/ai-foundation-certification/`).

For the AI Foundation's certification history and final verdict, see [docs/ai-foundation-certification/](../ai-foundation-certification/) and [docs/retrieval-intelligence/](../retrieval-intelligence/).
