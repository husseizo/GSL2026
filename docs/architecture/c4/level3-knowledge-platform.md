# C4 Level 3 — Component Diagram: Knowledge Platform (`knowledge-platform/`)

Zooms into the governed knowledge layer every AI capability (Catalogue AI, Demand Forecasting, and future capabilities) consumes — built in DGX Prototype 1.7, populated for real in 1.7.1.

```mermaid
flowchart TB
    subgraph Ingestion["Ingestion (11-stage pipeline)"]
        SourceRegistry["Knowledge Source Registry\n(license-eligibility gate)"]
        Parsing["parsing/\n(PDF, DOCX, OCR, ...)"]
        InjectionScanner["security/\n(document-ingestion prompt-injection scanner)"]
        Classify["ingestion/stages/classify"]
        StructuredExtraction["structured-ingestion/\n(claim-level provenance)"]
    end

    subgraph Governance["Review & Governance"]
        ReviewWorkflow["review-workflow/\n(multi-reviewer, dual review\nfor high-risk facts)"]
        ConflictDetection["Deterministic conflict detection"]
        Expiry["Expiry / supersession"]
    end

    subgraph Storage["Storage & Retrieval Contract"]
        KnowledgeItems[("Versioned Knowledge Items\n(append-only)")]
        StructuredFacts[("Structured Facts table\n(gated against unreviewed LLM output)")]
        Graph[("Postgres-relational\nKnowledge Graph")]
        Snapshots["Immutable blue-green snapshots"]
        RetrievalContract["Strict AI-consumer\nretrieval contract"]
    end

    Consumers["Catalogue AI, Retrieval Intelligence,\nfuture AI capabilities\n(additive, feature-flagged integration only)"]

    SourceRegistry --> Parsing --> InjectionScanner --> Classify --> StructuredExtraction
    StructuredExtraction --> ReviewWorkflow --> ConflictDetection --> Expiry
    Expiry --> KnowledgeItems
    Expiry --> StructuredFacts
    KnowledgeItems --> Graph
    KnowledgeItems --> Snapshots
    Snapshots --> RetrievalContract
    RetrievalContract --> Consumers
```

## Notes

- **No unreviewed LLM output ever reaches `StructuredFacts`** — the gate between `StructuredExtraction` and `ReviewWorkflow` is real and mandatory, not advisory.
- **Every consuming capability integrates additively** — the Catalogue AI integration point, and any future capability's integration, extends this platform without changing its own external behavior; this is the same pattern later reused for the Retrieval Intelligence Platform's circular-module wiring.
- Snapshots are blue-green and immutable — a knowledge update is a new snapshot, never an in-place edit to a previously-published one.
