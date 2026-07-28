# GitHub Discussions — Recommended Configuration

This document recommends a GitHub Discussions category structure for AIOS, should Discussions be enabled on this repository. **Discussions has not been enabled by this document** — enabling it and creating these categories requires a repository admin action via the GitHub UI/API.

## Recommended categories

| Category | Format | Purpose |
|---|---|---|
| **Announcements** | Announcement (maintainer-only posting) | Real releases, governance decisions (e.g. a Certification Standard amendment), and program-level status changes (e.g. a Phase closure). |
| **Architecture** | Open-ended discussion | Design conversations that are not yet a formal [Architecture Proposal](../.github/ISSUE_TEMPLATE/architecture_proposal.md) issue — early-stage thinking, questions about an existing architectural boundary. |
| **Ideas** | Q&A-style (allows upvoting/marking an answer) | Early-stage feature ideas not yet ready for a formal Feature Request issue. |
| **Questions** | Q&A | "How do I..." / "Why does X work this way" questions — a lower-friction alternative to the [Question issue template](../.github/ISSUE_TEMPLATE/question.md) for anything that doesn't need to be tracked as an actionable item. |
| **AI Research** | Open-ended discussion | Research topics named in the Enterprise Roadmap's [Research Areas](strategy/AIOS_ENTERPRISE_ROADMAP_V1.md#18-research-areas) (agentic AI, multi-agent collaboration, predictive diagnostics, simulation) — explicitly pre-commitment discussion, per that section's own framing. |
| **DGX** | Open-ended discussion | Discussion specific to DGX 2.0 Demand Forecasting (or future DGX 3.0-6.0 capabilities) that isn't a certification-relevant issue — e.g. real-world usage patterns once Business Operations begins generating organic forecast evidence. |
| **Operations** | Open-ended discussion | Business Operations' real, ongoing experience running the Manual operational model (see [`docs/execution/DGX2_PHASE_A_BASELINE_1_0.md`](execution/DGX2_PHASE_A_BASELINE_1_0.md)) — cadence feedback, planner experience, escalation patterns. |
| **Community** | Open-ended discussion | Anything that doesn't fit the categories above. |

## Why Discussions instead of (or alongside) Issues

Issues track actionable, closeable work with a clear "done" state (see [`docs/github-project-template.md`](github-project-template.md)). Discussions are for open-ended conversation that may never resolve to a single action — research questions, "what if," and operational experience-sharing fit Discussions better than an Issue that would otherwise sit open indefinitely with no real closure criterion.

## Moderation recommendation

Given this repository's own evidence-based discipline (no fabricated claims, no unverified assertions treated as fact), maintainers moderating **Announcements** and **AI Research** in particular should hold posts to the same standard the rest of this repository's documentation already follows: a claim about certification status, business value, or research findings should cite real evidence, not restate an aspiration as if it were a result.
