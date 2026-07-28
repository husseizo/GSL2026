# AI Platform (DGX Spark) — Design Only, Not Built in Phase 1

The DGX Spark is layer 5: local inference, RAG, embeddings, vector search, training/fine-tuning, forecasting, anomaly detection. It is never primary storage and never executes a transaction. This doc fixes the contracts and guardrails so Phase 1's data model doesn't foreclose them.

## 1. Service boundaries

| Service | Input | Output | Hard constraint |
|---|---|---|---|
| Knowledge assistant (RAG) | question + role scope | answer + citations + confidence | must state "insufficient evidence" rather than guess; never presents unverified advice as confirmed |
| Diagnostic assistant | VIN, symptoms, DTCs, history | ranked suspected causes, required tests, confidence | output fields are literally typed `suspectedCause \| testRequired \| confirmedCause` — a confirmed cause can only be set by a technician, never by the model |
| Parts matching | OEM/description/image/wording | exact / likely / compatible-alt / superseded / unverified | never auto-merges; writes `PartMatchCandidate` for human review (same queue as Phase 1's rule-based matcher) |
| Demand forecasting | item/category/branch time series | forecast + interval, by horizon (7/30/60/90/180/365d) | model selection must be justified by backtest metrics (MAE/RMSE/MAPE/WAPE/bias) — simplest model that meets the service-level target wins, no default-to-deep-learning |
| Failure-pattern model | brand/model/engine/mileage/DTC/service history | risk score + supporting case count | phrased as risk ("elevated X-system repair risk based on N similar vehicles"), never as certainty |
| Purchase recommendation | forecast + stock + supplier + margin + criticality | buy-now/buy-soon/monitor/... + free-text rationale citing the actual numbers | recommendation only; PO creation always requires human approval |
| Anomaly detection | transactional/log streams | flagged events + reason | feeds the audit/monitoring layer, does not auto-block transactions |

## 2. Non-negotiable governance rules (apply to every service above)

- Every output carries a model version and prompt version.
- Every technical claim cites its source record(s); "no source, no claim."
- Every output is stamped one of: `INFORMATIONAL | RECOMMENDED | APPROVED | REJECTED | EXECUTED` — nothing skips from `RECOMMENDED` to `EXECUTED` without a role-appropriate human action in between, logged in the audit layer.
- No LLM has unrestricted database write access. Business services (layer 6) mediate every write; the AI platform only calls scoped, purpose-built endpoints (e.g. "propose merge candidate", never "run arbitrary SQL").
- No AI-authored purchase order, diagnosis, or part-number merge is final without explicit approval by the relevant role (purchasing manager, technician, parts manager respectively).
- Lubricant/part recommendations are grounded strictly in the approved compatibility tables (§4 of the data model) — the model retrieves and ranks, it does not invent a specification or OEM approval.

## 3. Why this isn't built yet

Phase 1 has no forecast to run (no sales history loaded), no embeddings pipeline needed (rule-based matching suffices at this data volume), and no DGX access from this environment. Building the RAG/forecasting scaffolding now, against synthetic data, would produce interfaces that don't match what the real historical data actually looks like once it's synced — better to nail the sync contract and master data first (Phase 1), load real history (Phase 2–3), then design the AI services against real distributions (Phase 4+). See [04-roadmap.md](04-roadmap.md).
