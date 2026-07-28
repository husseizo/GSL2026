# C4 Level 2 — Container Diagram

Zooms into AIOS itself: the real, independently-deployable containers (services/applications/data stores) and the real protocols between them.

```mermaid
flowchart TB
    User["Browser\n(Inventory Planner, Manager, Admin)"]

    subgraph AIOS["AIOS system boundary"]
        WebPortal["web-portal\nVite + React + TypeScript\n(services/web-portal/)"]
        OperationalCore["operational-core\nNestJS modular monolith\n(services/operational-core/)"]
        DgxPlatform["dgx-ai-platform\nPython/FastAPI inference boundary\n(services/dgx-ai-platform/)"]
        Postgres[("PostgreSQL\nsystem of record")]
        Redis[("Redis\ncache / rate-limit\n(never a system of record)")]
        NeonCache[("Neon-style cache DB\n(never the primary write DB)")]
    end

    Ollama["Ollama\n(LLM + embedding runtime)"]
    SAP["SAP Business One\n(external, read-only)"]
    Odoo["Odoo\n(external, read-only)"]

    User -->|"HTTPS"| WebPortal
    WebPortal -->|"REST/JSON, Bearer JWT\nVITE_API_BASE_URL"| OperationalCore
    OperationalCore -->|"Prisma / SQL"| Postgres
    OperationalCore -->|"cache, rate-limit, queues"| Redis
    OperationalCore -->|"read-through cache sync"| NeonCache
    OperationalCore -->|"REST, DGX_SERVICE_URL\n(the only caller allowed to reach the AI boundary)"| DgxPlatform
    DgxPlatform -->|"OLLAMA_BASE_URL"| Ollama
    OperationalCore -->|"read-only adapters"| SAP
    OperationalCore -->|"read-only adapters"| Odoo
```

## Notes

- **`operational-core` is the sole system of record.** Every business transaction, every capability layer (forecasting, recommendations, knowledge platform, retrieval intelligence), and every enterprise-platform concern (identity, authorization, API platform, branch gateway, notifications, backup/DR, observability) lives inside this one modular monolith — see [Level 3 — Operational Core](level3-operational-core.md).
- **`dgx-ai-platform` has no database driver in its dependency tree** — it is a pure inference boundary in front of Ollama, reachable only from `operational-core`, never directly from the Web Portal or any external system.
- **Redis and the Neon-style cache database are both explicitly non-authoritative** — a Foundation-level invariant, not an implementation detail (see [Non-negotiables](../../../README.md#non-negotiables-unchanged-since-phase-1)).
- Real, current runtime ports for a given environment (which may differ from repository defaults) are documented in the root [README's Runtime Topology](../../../README.md#runtime-topology) section, not here — this diagram describes structure, not a specific host's current port assignments.
