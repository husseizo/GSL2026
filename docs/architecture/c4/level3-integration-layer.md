# C4 Level 3 — Component Diagram: Integration Layer

Zooms into how real external/legacy systems enter AIOS — always read-only, always staged and validated, never written back to.

```mermaid
flowchart TB
    subgraph External["Real external / legacy systems (read-only sources)"]
        SAPSource["SAP Business One"]
        OdooSource["Odoo"]
        TecDocSource["TecDoc / parts catalogue"]
        AutoHubSource["AutoHub commercial application"]
    end

    subgraph IntegrationLayer["integration/, data-consolidation/, cdc/"]
        Adapters["Adapters\n(integration/adapters/\nsap-business-one.adapter.ts,\nodoo.adapter.ts)"]
        Profiling["Profiling & staging\n(data-consolidation/)"]
        Matching["Confidence-scored matching\n(human-approved, never automatic)"]
        Reconciliation["Reconciliation to the cent\n(real Decimal arithmetic)"]
        CDC["cdc/\n(Postgres logical replication,\nreal, tested end to end)"]
    end

    OperationalCore["operational-core's\nOperational Core data\n(system of record)"]
    BranchGateway["branch-gateway/\n(offline-capable edge sync,\nstore-and-forward outbox)"]

    SAPSource -->|"read-only"| Adapters
    OdooSource -->|"read-only"| Adapters
    TecDocSource -->|"read-only"| Adapters
    AutoHubSource -->|"read-only"| Adapters
    Adapters --> Profiling --> Matching --> Reconciliation --> OperationalCore
    CDC -.->|"logical replication,\nno application code path"| OperationalCore
    OperationalCore <--> BranchGateway
```

## Notes

- **No automatic merge of an uncertain match ever occurs** — `Matching` always proposes; a human always approves before `Reconciliation` commits data into the Operational Core. This is a Foundation-level, non-negotiable invariant.
- **External source systems are never written to** — every arrow above is one-directional, into AIOS, never back out to SAP/Odoo/TecDoc/AutoHub.
- **Branch Gateway is the offline-capable edge integration path** — a real, tested store-and-forward outbox for branches that may lose connectivity, distinct from the read-only external-system adapters above it.
