# DGX 2.0 — Demand Forecasting Certification Standard v1.0

### The Permanent Standard Governing When Demand Forecasting May Be Trusted With Procurement Decisions

---

## 1. Document Control

| Field | Value |
|---|---|
| Document name | DGX 2.0 — Demand Forecasting Certification Standard |
| Version | 1.0 |
| Status | APPROVED CERTIFICATION FRAMEWORK — not yet executed against a real release |
| Owner | AIOS Architecture (Molas Solutions Engineering), jointly with Procurement and Operations leadership (§23) |
| Audience | Engineers preparing a forecasting release for certification; procurement, warehouse, and branch stakeholders who must sign off on trust; technical managers deciding whether a forecasting change may reach production |
| Review cycle | Reviewed at every certification cycle, and at minimum annually, or immediately upon any material change to forecast methods, business rules, or scope. |
| Dependencies | Requires [`docs/architecture/AIOS_FOUNDATION_ARCHITECTURE_SPECIFICATION_V1.md`](../architecture/AIOS_FOUNDATION_ARCHITECTURE_SPECIFICATION_V1.md) and [`docs/capabilities/DGX_2_DEMAND_FORECASTING_SPECIFICATION_V1.md`](../capabilities/DGX_2_DEMAND_FORECASTING_SPECIFICATION_V1.md). This document does not restate their content; it defines how compliance with them is *proven*. |
| Certification status referenced by this document | AI Foundation: `AI_FOUNDATION_CERTIFIED`. Demand Forecasting capability: **not yet certified under this standard** — no certification cycle has been executed as of this writing. |

This is not an implementation guide and not a sprint report. It is the permanent evaluation standard — the thing a real certification run is measured against, the same way `scripts/verify-ai-foundation-certification.ts` and the AI Foundation's quality gates are the real, executed standard behind `AI_FOUNDATION_CERTIFIED`. No forecasting release may claim any level of trust described in this document without a real, executed, evidence-based certification run against it.

> **Status update (non-invasive, added without altering this Standard's rules, thresholds, or scoring):** the "Certification status" row above was accurate as of this document's original (v1.0) writing. This Standard has since been amended additively — see [`DGX2_CERTIFICATION_STANDARD_AMENDMENT_V1_1.md`](DGX2_CERTIFICATION_STANDARD_AMENDMENT_V1_1.md) — and two real certification runs have been executed under it (v1.1), both returning verdict `NOT_READY`. For the current, authoritative record, see [`docs/execution/DGX2_PHASE_A_BASELINE_1_0.md`](../execution/DGX2_PHASE_A_BASELINE_1_0.md).

---

## 2. Purpose

**AI Foundation Certification proved: "Can AI retrieve and reason correctly?"**

**DGX 2.0 Certification must prove: "Can the business trust forecasting recommendations enough to act on them?"**

These are different questions, evaluated by different methods, and one does not imply the other.

Retrieval correctness is measured against a fixed, real, human-approved gold dataset with a single right answer per query (`RETRIEVAL_INTELLIGENCE_GOLD_EVAL_V1`, and its successors) — an OEM number either resolves to the correct part or it does not. Forecasting has no single right answer per case: it produces a probability-weighted estimate about a future that has not happened yet, feeding a human decision that has real financial and operational consequences (§3). **A capability with perfect code and zero bugs can still be a bad forecaster, and a forecaster with excellent statistical accuracy can still be untrustworthy if its recommendations are unsafe, unexplainable, or ignored by the humans who are supposed to use them.**

This is why AI Foundation certification, by itself, is not — and cannot be — sufficient for Demand Forecasting (`AIOS_FOUNDATION_ARCHITECTURE_SPECIFICATION_V1.md`, invariant 20; `DGX_2_DEMAND_FORECASTING_SPECIFICATION_V1.md` §25). This document exists to close that gap with its own, purpose-built standard.

---

## 3. Certification Philosophy

> Forecasts influence procurement.
> Procurement affects inventory.
> Inventory affects revenue.
> Revenue affects customers.

Each link in that chain is a real, consequential business decision — not an abstract accuracy score. This is why forecasting must be evaluated differently from retrieval:

- Retrieval certification asks: *was the right answer found?*
- Forecasting certification asks: *was the right decision supported, safely, explainably, and in a way a human could verify and act on?*

**Forecasts are recommendations. Not orders.** Every principle in this document exists to keep that sentence true in practice, not just in prose — a certification framework that lets a "highly accurate" forecast bypass human judgment has failed at its actual job, regardless of its measured statistical error.

---

## 4. Certification Levels

Four levels, each strictly cumulative — a level cannot be claimed without every requirement of the level below it also being real and currently true.

| Level | What it means | Unlocks |
|---|---|---|
| **Bronze** | The capability is *safe* — every Safety Gate (§8) and Human Trust Gate (§9) passes in real testing. Confidence and evidence are always visible. No recommendation can bypass human approval. Statistical accuracy may still be modest. | `LIMITED_PILOT` (§22) — real use by a small, supervised group of planners, with close monitoring. |
| **Silver** | Bronze, plus real, measured Forecast Accuracy (§6) meets agreed thresholds across the real Scenario Test Suite (§11), and the Explainability Standard (§15) is fully met for every recommendation type. | `PILOT_APPROVED` (§22) — a defined, real pilot scope (e.g., specific branches or item categories) with planners using recommendations in normal (not just supervised) work. |
| **Gold** | Silver, plus real, measured Business Value (§7) has been demonstrated over a real pilot period, Business Simulation replay testing (§13) shows no material regression against actual historical outcomes, and Recommendation Evaluation (§14) shows a healthy real acceptance rate. | `PRODUCTION_READY` (§22) — broad, real production use across the intended scope. |
| **Enterprise** | Gold, plus validated across multiple real branches/warehouses/suppliers, full Observability (§18) is operating continuously, Governance (§23) sign-off exists from every required stakeholder group, and a continuous re-certification process (§19, §24) is actually running, not just documented. | `ENTERPRISE_CERTIFIED` (§22) — the highest trust level; recommendations may be relied on as the default planning input across the full real business scope. |

No level, once reached, is permanent. Certification is continuous (§19, §24) — a level can be lost by a real regression, and must be re-earned.

---

## 5. Evaluation Categories

Every certification run evaluates all nine categories below. A release cannot selectively pass only the categories it is strong in.

1. **Forecast Quality** — §6, §11.
2. **Operational Safety** — §8, §12.
3. **Business Value** — §7, §13.
4. **Human Trust** — §9, §14.
5. **Explainability** — §15.
6. **Performance** — §16.
7. **Reliability** — §12, §18.
8. **Security** — §17.
9. **Governance** — §23.

---

## 6. Forecast Accuracy Metrics

| Metric | Why it matters | Business impact | Acceptable range (guidance — set formally per item class in §20's dataset) |
|---|---|---|---|
| MAPE (Mean Absolute Percentage Error) | Familiar, easy to communicate | Misleading alone on intermittent-demand automotive parts — never used as the sole gate metric (`docs/capabilities/DGX_2_DEMAND_FORECASTING_SPECIFICATION_V1.md` §10, §16) | Reported, never gating alone |
| WMAPE / WAPE (Weighted MAPE) | Weights error by real demand volume | Prevents a handful of low-volume items from dominating the apparent error rate | Gates by item class; fast-moving items held to a tighter range than slow-moving/intermittent items |
| MASE (Mean Absolute Scaled Error) | Comparable across items with very different volumes and intermittency | The correct metric for judging whether a model beats a naive baseline on real, sparse automotive-parts demand | MASE < 1 required — a forecast that cannot beat a naive baseline provides no real value |
| Bias | Systematic over/under-forecasting direction | A "low-error-on-average" model that always over-forecasts still causes real, chronic excess stock; one that always under-forecasts still causes real, chronic stockouts | Bounded around zero, evaluated per item class, not only in aggregate |
| Forecast Error (absolute/real) | The raw, real gap between forecast and actual | Grounds every scaled metric above in a real, inspectable number | Reported alongside every scaled metric, never replaced by it |
| Service Level | Real probability of not stocking out during a replenishment cycle | Directly reflects whether procurement timing is actually working | Set per criticality tier, higher for critical/fast-moving items |
| Fill Rate | Real % of demand met immediately from stock | The customer-facing consequence of forecast + procurement quality together | Set per item class |
| Forecast Stability | How much a forecast for the same future period changes as new real data arrives | A forecast that swings wildly run-to-run cannot be planned against, even if each individual run looks statistically fine | Bounded run-to-run variance for a stable item |
| Prediction Interval Coverage | Real % of actual outcomes that fall within the forecast's stated confidence interval | This is what makes "confidence" in §10 a real, calibrated statement rather than a label — if 80%-confidence intervals only contain the real outcome 40% of the time, the confidence labels are lying | Calibration checked directly: stated confidence must match real, observed coverage |

Every metric above must be computed from real backtested history (`docs/capabilities/DGX_2_DEMAND_FORECASTING_SPECIFICATION_V1.md` §11) — never estimated, never assumed, never reported from a single favorable run instead of the full real evaluation set (§20).

---

## 7. Business KPIs

| KPI | Purpose | Measurement | Evidence | Target | Risk if degraded |
|---|---|---|---|---|---|
| Stockout Reduction | Prove the capability reduces real lost availability | Real stockout incident rate, before vs. after | `InventoryBalance`/`InventoryMovement` history | Measurable, sustained real reduction | Silent stockout increase directly harms customers and revenue |
| Inventory Turnover | Prove capital efficiency improves | COGS / average real inventory value | Real inventory valuation data | Measurable, sustained real improvement | Capital increasingly tied up in unsold stock |
| Emergency Purchase Reduction | Prove procurement timing is genuinely improving | Real rate of expedited/rush purchases | `PurchaseDocument` data (pending the real "rush" flag noted as a gap in `DGX_2_DEMAND_FORECASTING_SPECIFICATION_V1.md` §21) | Measurable, sustained real reduction | Continued premium freight cost, weaker supplier terms |
| Dead Stock Reduction | Prove the capability helps identify and reduce non-moving inventory | Real `MovementClass = DEAD_STOCK`/`NON_MOVING` population trend | `InventoryItemMetric` | Measurable, sustained real reduction | Continued capital loss on unsellable stock |
| Supplier Performance | Prove forecasting-informed procurement improves supplier relationships | Real lead-time and fulfillment reliability trend | `supplier-analytics/` real metrics | Stable or improving | Undermines negotiating position and delivery reliability |
| Working Capital | Prove the aggregate financial effect is real and positive | Real inventory investment vs. real service level trade-off | Combined real inventory + sales data | Measurable, sustained real improvement | Forecasting could be "accurate" yet financially harmful if it drives over-ordering |
| Recommendation Acceptance Rate | Prove planners find recommendations genuinely useful | Real % of recommendations accepted as-is | `RecommendationStatus` history | High, and stable or improving | A low or declining rate means the tool is being ignored — a Human Trust failure regardless of statistical accuracy |
| Recommendation Override Rate | Surface real gaps in the model or business rules | Real % rejected or materially adjusted | `RecommendationStatus` history + planner-entered reason | Low, and investigated whenever it rises | A rising override rate is a real early-warning signal, not just a metric to minimize by pressure |
| Forecast Adoption | Prove real, voluntary usage, not just availability | Real % of in-scope items with an actively-reviewed forecast | `ForecastRun` + review activity | High within certified scope | Low adoption means the certification's real-world value is unproven regardless of lab metrics |
| Procurement Planning Accuracy | Prove the forecast actually improves real planning outcomes, not just the raw number | Real comparison of planned vs. actual procurement cycles | Combined `ForecastRun` + `PurchaseDocument` outcome data | Measurable, sustained real improvement | The forecast could be numerically accurate yet never actually change real planning behavior |

---

## 8. Safety Gates

These are the forecasting-specific instances of the Foundation's own safety discipline (`AIOS_FOUNDATION_ARCHITECTURE_SPECIFICATION_V1.md` §10, zero-tolerance gates) — every gate below has **zero tolerance**, verified by real, executed tests, not by convention:

1. Never recommend an impossible order (a quantity, supplier, or timing that cannot actually be fulfilled).
2. Never violate real warehouse capacity limits.
3. Never violate a real supplier's minimum order quantity or package quantity.
4. Never ignore a real supplier constraint (availability, active status, lead time floor).
5. Never recommend an unavailable or discontinued product.

> **Business Rules always override AI.** No statistical confidence, however high, may cause a Safety Gate to be bypassed. A single real, confirmed violation of any gate above blocks certification at every level, regardless of how well every other category scores.

---

## 9. Human Trust Gates

1. Every recommendation must explain itself in plain, real business language (§15).
2. Confidence must always be visible — never omitted, never implied only by tone.
3. Evidence must always be visible — the real data behind the recommendation, not just a conclusion.
4. Source must always be visible — which real `ForecastRun`/`InventoryItemMetric`/supplier-metric rows produced this recommendation.
5. Reason must always be visible — which business rule or forecast signal actually drove this specific action.
6. The planner always has final approval — no recommendation reaches a real ERP action without it (`AIOS_FOUNDATION_ARCHITECTURE_SPECIFICATION_V1.md` §7; `DGX_2_DEMAND_FORECASTING_SPECIFICATION_V1.md` §15).

Failing any Human Trust Gate blocks certification regardless of statistical accuracy — a highly accurate forecast that no planner can understand or verify has not earned trust, it has only earned a number.

---

## 10. Confidence Evaluation

| Confidence | Meaning | Certification requirement |
|---|---|---|
| **HIGH** | Real, sufficient history; low real backtest error; stable real pattern (real `RecommendationConfidence.HIGH`) | Must be real and calibrated (§6, Prediction Interval Coverage) — never inflated to make the tool look more capable than it is |
| **MEDIUM** | Real but shorter/noisier history, or intermittent/variable demand | Must be presented with the same visibility and evidence discipline as HIGH — never downplayed |
| **LOW** | Thin, highly variable real history, or a recent material real business-condition change | Must never be silently rounded up to MEDIUM to look more useful |
| **INSUFFICIENT DATA** | Not enough real history to forecast meaningfully (`RecommendationConfidence.INSUFFICIENT_DATA`) | The capability must abstain — no plausible-sounding number may be manufactured |
| **UNKNOWN** | A real, detected condition the capability cannot classify into the above (e.g., a genuinely new, unclassified failure mode) | Must default to the same abstain behavior as INSUFFICIENT DATA — "unknown" is never silently treated as safe |

> **When DGX must abstain**: whenever real confidence is INSUFFICIENT DATA or UNKNOWN, the capability must say so explicitly and decline to manufacture a specific recommended quantity — matching the Foundation's own failure philosophy (`AIOS_FOUNDATION_ARCHITECTURE_SPECIFICATION_V1.md` §13: *"Failure must reduce capability, not invent certainty"*).

---

## 11. Scenario Test Suite

Every certification run evaluates the categories below, using real historical data (§20) — no scenario may be satisfied with synthetic or fabricated cases.

| Scenario | Purpose | Success criteria | Failure criteria |
|---|---|---|---|
| Fast-moving items | Prove accuracy where volume is high and patterns are clearest | Meets the tightest accuracy/service-level thresholds (§6) | Misses thresholds on the easiest real category |
| Slow-moving items | Prove the capability does not force dense-series assumptions onto sparse data | Appropriately wide confidence intervals, no forced over-precision | Overconfident forecasts on real thin data |
| Intermittent demand | Prove Croston-class handling works on real, sparse automotive-parts patterns | MASE < 1 vs. naive baseline | Systematic over/under-forecasting bias on real zero-heavy series |
| Seasonal demand | Prove real seasonal patterns are captured where real history supports it | Seasonal effect detected and reflected only where real data justifies it | Seasonality assumed without sufficient real history, or missed where real history clearly shows it |
| New products | Prove honest low-confidence behavior for genuinely new real items | Correctly reports LOW/INSUFFICIENT DATA, never a confident guess | A confident number produced with no real supporting history |
| Stockout recovery | Prove real historical stockout periods don't distort future forecasts | Real stockout-period correction applied (§11 of the capability spec) | Zero-demand-during-stockout misread as real low demand |
| Supplier delay | Prove real lead-time variability is reflected in the recommendation | Recommendation adjusts safety stock/timing appropriately | Recommendation ignores a real, known supplier delay pattern |
| Branch expansion | Prove the capability handles a real, growing branch honestly | LOW/MEDIUM confidence with appropriate caveats, not a false HIGH | Confident forecast unsupported by the new branch's real short history |
| Branch closure | Prove the capability correctly stops recommending for a real closed/closing branch | No further reorder recommendations generated | Recommendations continue for a real branch no longer operating |
| Missing data | Prove graceful degradation, not fabrication | Explicit `REVIEW_DATA`/abstain behavior | A forecast produced despite real, known data gaps |
| Garage demand | Prove real workshop consumption is captured, not just counter sales | `GarageJob` consumption reflected in the real forecast | Demand understated because only `SalesDocumentLine` was used |
| Lubricant demand | Prove category-specific real patterns (e.g., service-interval-driven demand) are handled | Real, sensible forecasts for real lubricant SKUs | Generic treatment ignoring real lubricant-specific consumption patterns |
| Parts demand | Prove real parts-specific patterns (e.g., failure-driven, less regular demand) are handled | Real, sensible forecasts for real parts SKUs | Generic treatment ignoring real parts-specific demand shape |
| Emergency demand | Prove the capability correctly flags real, unplanned demand spikes rather than smoothing them away | Spike reflected in recommendation reasoning, with appropriate confidence | Real spike silently averaged into a misleadingly smooth forecast |

---

## 12. Operational Safety Testing

Real, executed failure-injection testing — not merely theoretical resilience claims:

| Condition | Required behavior |
|---|---|
| Supplier unavailable | Recommendation excludes the unavailable supplier; explicit reasoning states why |
| Negative stock (a real data anomaly) | Detected and flagged as `REVIEW_DATA`, never silently treated as zero or ignored |
| Zero history | `INSUFFICIENT_DATA` confidence, no fabricated number |
| Missing lead time | Recommendation proceeds without a lead-time-based adjustment, explicitly disclosed, never a silently-assumed default |
| Duplicate data | Detected and deduplicated, or flagged for review if deduplication cannot be done safely |
| Corrupted data | Detected, request degrades explicitly (per the Foundation's failure philosophy), never silently "succeeds" on bad input |
| Delayed synchronization (stale real operational data) | The staleness is disclosed as part of the recommendation's evidence, not hidden |
| DGX unavailable | No effect on the classical baseline (`DGX_2_DEMAND_FORECASTING_SPECIFICATION_V1.md` §18); any future AI-assisted component degrades to the classical result explicitly, per the Foundation's AI Gateway contract |

Every condition above must be tested with a real, reproducible failure-injection case, and the result recorded as part of the certification evidence (§20).

---

## 13. Business Simulation

**Replay testing is mandatory before Gold or higher.** Using real historical data, for a real, defined historical period:

1. Take the real historical inputs available *as of* that point in time (never using future data the real business did not have yet).
2. Generate the real forecast and recommendation the capability would have produced.
3. Compare, side by side: **Actual** (what real demand/outcome occurred) vs. **Forecast** (what was predicted) vs. **Recommendation** (what action was suggested) vs. **Business Outcome** (what a real procurement/inventory outcome resulted, using the real historical decision) vs. **Human Decision** (what a real planner actually did at the time, if recorded).

This is the forecasting equivalent of the Foundation's rule that certification must be measured against the full real dataset, never a convenient sample (`AIOS_FOUNDATION_ARCHITECTURE_SPECIFICATION_V1.md` §11) — a replay simulation using cherry-picked, favorable historical periods is not a real certification test.

---

## 14. Recommendation Evaluation

| Real status | Business meaning |
|---|---|
| Accepted (`RecommendationStatus.APPROVED`) | The recommendation matched real planner judgment as-is. |
| Rejected (`RecommendationStatus.REJECTED`) | The recommendation did not match real planner judgment at all — every rejection is a real signal to investigate, not just a number to track. |
| Modified | The planner used the recommendation as a real starting point but changed it — a partial trust signal, tracked distinctly from a clean accept or reject. |
| Ignored | No real planner action was taken at all — distinct from rejection, and itself a real trust signal (a planner who doesn't reject but also doesn't use the tool is not exhibiting trust). |
| Implemented (`RecommendationStatus.IMPLEMENTED`) | The recommendation became a real ERP action. |
| Expired (`RecommendationStatus.EXPIRED`) | The recommendation window passed with no real decision — worth investigating whether this reflects planner overload, low relevance, or a real process gap. |
| Cancelled | A real, deliberate withdrawal of the recommendation, distinct from expiry — should be rare, and investigated when it is not. |

Every status above must be measured over time, per item class and per branch, not only in aggregate — an aggregate acceptance rate can hide a real, concentrated trust failure in one category.

---

## 15. Explainability Standard

Every recommendation, without exception, must answer:

1. **Why?** — what real signal(s) drove this recommendation.
2. **Why now?** — what real timing factor made this the moment to act.
3. **Why this quantity?** — the real calculation and inputs behind the specific number.
4. **Why this supplier?** — the real basis for supplier selection, where applicable.
5. **Why not another action?** — why `BUY_NOW` was chosen over `BUY_SOON`/`MONITOR`/`TRANSFER`/`DO_NOT_BUY`, etc. (`PurchaseRecommendationAction`, per `DGX_2_DEMAND_FORECASTING_SPECIFICATION_V1.md` §13).
6. **Confidence?** — explicit, per §10.
7. **Evidence?** — the real, specific data points behind the answer to every question above.

A recommendation that cannot answer all seven questions in real, human-readable language fails the Explainability Standard outright, regardless of its statistical accuracy.

---

## 16. Performance Gates

| Gate | Requirement |
|---|---|
| Forecast runtime | A real, agreed per-item/per-batch time budget, measured against real production-scale data volume. |
| Recommendation runtime | A real, agreed response-time budget for a planner's live working view. |
| Batch processing | Real, measured throughput sufficient for the full real in-scope catalogue within the business's real operational cycle (e.g., overnight). |
| Scalability | Demonstrated real performance at the target real branch/warehouse/item count, not only at a small pilot scale. |
| Latency | Consistent with the Foundation's own latency-gate discipline (`AIOS_FOUNDATION_ARCHITECTURE_SPECIFICATION_V1.md` §10) — measured, not assumed. |

---

## 17. Security

- **Branch scope** — every recommendation view respects real branch authorization.
- **Warehouse scope** — every transfer recommendation respects real warehouse authorization.
- **Supplier scope** — supplier commercial detail respects existing real authorization on `Supplier`/`PurchaseDocument` data.
- **Role permissions** — every role in `DGX_2_DEMAND_FORECASTING_SPECIFICATION_V1.md` §5 sees only what it is authorized to see, verified by real, executed tests, not by design intent alone.
- **Audit logs** — every recommendation's full real lifecycle is logged and immutable, per the Foundation's audit model.

No certification level may be granted while a known, real security gap (`AIOS_FOUNDATION_ARCHITECTURE_SPECIFICATION_V1.md` §12, §21) is unaddressed for the specific scope being certified.

---

## 18. Observability

Certification requires, as running, real infrastructure — not merely a design document:

- **Forecast history** — every real `ForecastRun`, queryable historically.
- **Recommendation history** — every real recommendation's full lifecycle.
- **Model version** — which real method produced a given forecast.
- **Rule version** — which real business-rule set was applied.
- **Confidence history** — real, tracked confidence over time per item.
- **Business outcome history** — real, measured KPI trend data (§7), not a single point-in-time snapshot.

A certification claim with no real, running observability behind it is not a certification — it is an assertion, exactly what this whole standard exists to prevent.

---

## 19. Regression Testing

> **Every production issue becomes a permanent benchmark. Never remove difficult cases. Never weaken datasets.**

This is the same rule the AI Foundation applied to its own gold dataset (`AIOS_FOUNDATION_ARCHITECTURE_SPECIFICATION_V1.md` §11, §16) — a real forecasting failure found in production (a bad recommendation, a missed stockout, a safety-gate near-miss) must become a durable, real regression case in the Certification Dataset (§20), never quietly patched and forgotten. A certification level, once granted, is re-verified against the full, growing real regression suite — not just the cases that existed when it was first earned.

---

## 20. Certification Dataset

A future, dedicated, real benchmark dataset — analogous in spirit and rigor to `RETRIEVAL_INTELLIGENCE_GOLD_EVAL_V1`/`V2`, but built for forecasting's different evaluation shape. It must include:

- Real historical demand data, spanning enough real time to cover genuine seasonal cycles.
- Real seasonal data.
- Real intermittent-demand items.
- Real garage/workshop consumption data (`GarageJob`).
- Real lubricant demand data.
- Real parts demand data.
- Real multi-branch data.
- Real multi-warehouse data.
- Real supplier-change events (a supplier switch, a lead-time change).
- Real economic-change periods, where the real business has data spanning one.
- Real business cases — actual past procurement decisions and their actual outcomes, not hypothetical ones.

This dataset does not yet exist as a formally versioned artifact. Building it is a prerequisite for any certification run above Bronze, and it must follow the same append-only, human-approved, real-case-only discipline as the AI Foundation's gold dataset (`AIOS_FOUNDATION_ARCHITECTURE_SPECIFICATION_V1.md` §11) — no synthetic case may substitute for a real one.

---

## 21. Release Gates

Mandatory checklist before any certification level is granted or re-affirmed:

- [ ] Forecast Accuracy metrics (§6) meet the agreed thresholds for the target level and scope.
- [ ] Business KPIs (§7) show real, measured evidence appropriate to the target level.
- [ ] Security (§17) verified with no open, relevant gap.
- [ ] Performance (§16) gates met at real target scale.
- [ ] Regression suite (§19) passes in full, including every real historical failure case.
- [ ] Documentation (this standard, the capability specification, and the run's own evidence record) is complete and current.
- [ ] Approval obtained from every required governance stakeholder (§23).

No release gate may be waived silently. Any exception must be explicit, time-bound, and documented with the same rigor the Foundation requires of an ADR (`AIOS_FOUNDATION_ARCHITECTURE_SPECIFICATION_V1.md` §20).

---

## 22. Certification Verdict

Exactly one verdict is issued per certification run, based entirely on real, measured evidence — never asserted, never assumed:

| Verdict | Meaning |
|---|---|
| **NOT_READY** | One or more Safety Gates (§8) or Human Trust Gates (§9) fails. No real-world reliance on recommendations is appropriate at any scope. |
| **LIMITED_PILOT** | Bronze level achieved. Safe for supervised use by a small, defined planner group, with close, real monitoring and no unsupervised reliance. |
| **PILOT_APPROVED** | Silver level achieved. Safe for normal (not just supervised) planner use within a defined, real pilot scope. |
| **PRODUCTION_READY** | Gold level achieved. Safe for broad, real production use across the certified scope. |
| **ENTERPRISE_CERTIFIED** | Enterprise level achieved. The highest trust tier — recommendations may be relied on as the default real planning input across the full certified business scope, with continuous re-certification actively running. |

A verdict applies only to the real scope it was measured against (specific item classes, branches, warehouses) — it is never silently generalized to an uncertified scope.

---

## 23. Governance

Certification is a joint decision, not an engineering-only sign-off. Required approvers:

- **Engineering** — confirms the technical evidence (§6, §12, §16-§18) is real, complete, and reproducible.
- **Operations** — confirms Operational Safety (§8, §12) and Performance (§16) hold at real operational scale.
- **Inventory** — confirms Business KPIs (§7) and Business Simulation (§13) results are meaningful and correctly interpreted.
- **Procurement** — confirms Human Trust (§9), Explainability (§15), and Recommendation Evaluation (§14) reflect a tool procurement staff actually find trustworthy, not just a tool that scores well on paper.
- **Management** — confirms the overall business case and governance sign-off, and formally accepts the certified verdict and its scope.

No certification level may be granted with any required approver's sign-off missing.

---

## 24. Future AI Evaluation

Classical forecasting (Phase A, per `DGX_2_DEMAND_FORECASTING_SPECIFICATION_V1.md` §24) is evaluated entirely by this standard as written. **Any future AI-assisted forecasting component (Phase C, "Hybrid AI") must be evaluated separately from classical forecasting, never assumed to inherit a classical method's certification.**

- A model change (a new algorithm, a new AI-assisted component, a materially retrained model) **requires re-certification** — it does not carry forward the previous certification level automatically.
- Any AI-assisted component is additionally subject to every Foundation rule on provider abstraction and AI Gateway usage (`AIOS_FOUNDATION_ARCHITECTURE_SPECIFICATION_V1.md` §6, §17) — those rules are necessary but not sufficient; this certification standard's business-trust evaluation still applies in full on top of them.
- AI Foundation certification remains scoped to retrieval correctness. It never substitutes for, and is never cited as satisfying, any requirement in this document.

---

## 25. Engineering Commitment

**Forecast to assist. Never automate blindly.**

**Business before benchmark.**

**Trust before intelligence.**

A statistically excellent forecast that a planner cannot verify, that violates a safety gate, or that the business does not actually use is not a success — it is an unearned claim. Certification under this standard is the business's proof, not engineering's assertion, that a real forecasting recommendation is safe enough, explainable enough, and valuable enough to act on. **Forecasts remain recommendations. Humans remain accountable. Confidence remains visible. Evidence remains preserved. Certification remains continuous — never a one-time event.**

---

## 26. Appendices

### A. Example scorecard (illustrative structure only — real values require a real certification run)

| Category | Score/Status | Evidence reference |
|---|---|---|
| Forecast Quality | *(real MASE/WAPE/bias per item class)* | Certification Dataset run ID |
| Operational Safety | Pass/Fail per gate (§8) | Real safety-test execution log |
| Business Value | *(real KPI deltas, §7)* | Real pilot-period measurement |
| Human Trust | *(real acceptance/override rates, §14)* | Real recommendation history |
| Explainability | Pass/Fail per recommendation type (§15) | Real sample review |
| Performance | *(real runtime/latency figures, §16)* | Real load-test log |
| Reliability | Pass/Fail per failure-injection case (§12) | Real test execution log |
| Security | Pass/Fail per scope check (§17) | Real permission-test log |
| Governance | Approver sign-offs (§23) | Signed approval record |
| **Verdict** | *(one of §22)* | This scorecard, in full |

### B. Example dashboard panels (illustrative — mirrors the AI Foundation Certification Dashboard's real, self-hosted pattern)

- Current certification level and verdict, with scope.
- Forecast accuracy trend (WAPE/MASE/bias) over time, per item class.
- Recommendation acceptance/override/ignored trend.
- Open Safety Gate violations (must always read zero for any certified level).
- Business KPI trend (§7) since the last certification run.

### C. Certification run template

```
# Certification Run <id> — <date>

## Scope
Branches / warehouses / item classes covered.

## Evidence
Links to real data, test logs, and scorecards (Appendix A) for every
evaluation category in §5.

## Safety Gate Results
Pass/Fail for every gate in §8, with real evidence.

## Verdict
One of: NOT_READY / LIMITED_PILOT / PILOT_APPROVED / PRODUCTION_READY /
ENTERPRISE_CERTIFIED (§22).

## Governance Sign-off
Named approval from Engineering, Operations, Inventory, Procurement,
Management (§23).

## Next Review Date
Per §1's review cycle, or immediately upon material change (§24).
```
