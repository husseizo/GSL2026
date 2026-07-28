# Multilingual (Swahili/Mixed-Language) Review

## Requirement

Per spec, Swahili and mixed-language content requires a real, fluent human reviewer — machine translation alone is never sufficient to approve such content.

## Real status this pilot

The reviewer-role and decision mechanism (`KnowledgeReviewService.decide()`, unmodified from DGX 1.7) supports assigning any content to any named reviewer role regardless of language, and nothing in the pipeline auto-approves non-English content. However, **no real Swahili or mixed-language source document was onboarded this pilot** — all 4 real production sources (internal SOPs, Liqui Moly cache, TecDoc catalogue, repair cases) are English-language content. The spec's 100+ Swahili/mixed-language case target was not reached with real content.

## Honest limitation, stated plainly

This is a real, named gap, not something this pilot attempted to fabricate around. A future phase would need to either (a) onboard a real source containing genuine Swahili/mixed-language automotive content, or (b) have a real fluent bilingual reviewer author genuine bilingual SOP content. Neither happened this pilot. Whether the *review mechanism itself* correctly blocks on a human decision for non-English content was verified using the verify script's synthetic fixtures, proving the mechanism works — it does not substitute for a real fluency review having actually occurred, which an AI acting as reviewer cannot itself verify or fabricate.

## Gold evaluation dataset impact

The `TRUSTED_KNOWLEDGE_GOLD_EVAL_V1` benchmark's 114 real cases (see [evaluation-dataset.md](evaluation-dataset.md)) contain 0 real Swahili/mixed-language cases against the spec's 30-case target — reported honestly in [evaluation-dataset.md](evaluation-dataset.md) rather than backfilled with synthetic translations.
