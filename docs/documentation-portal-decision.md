# Documentation Portal Decision Record

## Status

**Decision made. Not yet implemented.** This document is the Decision Record, target Directory Structure, Migration Plan, and Navigation Tree for a future documentation portal — no portal has been built, and no existing file has been moved as part of this decision.

## Decision

**MkDocs, with the Material for MkDocs theme, is the chosen documentation portal tooling** — not Docusaurus.

## Decision criteria

| Criterion | MkDocs (Material theme) | Docusaurus |
|---|---|---|
| **Maintenance** | A single YAML nav file (`mkdocs.yml`) plus plain Markdown; no build step beyond `pip install` + `mkdocs build`; very low ongoing maintenance for a docs-only corpus. | Requires a Node.js toolchain, React component knowledge for anything beyond plain MDX pages, and its own dependency-upgrade cadence — more moving parts for a repository whose documentation is 95%+ plain prose and Mermaid, not interactive UI. |
| **Performance** | Static site generation is fast; large plain-Markdown corpora (this repo has hundreds of `.md` files) build quickly. | Also static-site-generated and fast, but the React/webpack build pipeline is heavier for an equivalent page count. |
| **Search** | Built-in client-side search (Material theme) is good out of the box; can be upgraded to a hosted search provider later without a structural change. | Built-in search (via Algolia DocSearch or local search plugins) is comparable, but typically needs an external service (Algolia) for the best experience. |
| **Versioning** | The `mike` plugin provides real, git-based multi-version doc hosting, a natural fit for this repository's own append-only, versioned-baseline discipline (frozen phase baselines, dataset `v1`/`v2`, Certification Standard `v1.0`/Amendment `v1.1`). | Docusaurus has strong native versioning support too — comparable capability, but no meaningfully better fit for this repo's specific versioning pattern. |
| **Developer experience** | Any contributor who can write Markdown can contribute — no React/JSX knowledge required, matching the fact that most contributors to `docs/` are not necessarily `web-portal` frontend engineers. | Better developer experience specifically if the docs need interactive, component-driven pages (API explorers, live diagrams) — not currently a real requirement for this corpus. |
| **GitHub Pages** | First-class, simple `mkdocs gh-deploy` support. | Also first-class via `docusaurus deploy` — parity here. |
| **Enterprise suitability** | Widely used for exactly this kind of engineering/architecture/governance documentation corpus (heavy cross-referencing, versioned standards, diagrams-as-code) in mature engineering organizations. | Also enterprise-proven, but its strengths (MDX interactivity, React component embedding) are aimed at a different kind of documentation site than AIOS currently has. |

**Why MkDocs wins for AIOS specifically**: this repository's documentation is not building a marketing site or an interactive component library — it is a large, cross-referenced, versioned corpus of architecture specifications, governance standards, certification records, and Mermaid diagrams, authored and maintained by engineers who already write plain Markdown for every ADR, decision log, and specification in this repo. MkDocs adds the least new tooling surface to that existing discipline, and its `mike` versioning plugin maps naturally onto this repository's own versioned-artifact conventions (v1.0/v1.1 standards, frozen baselines).

## Target directory structure (not yet created)

```
docs/
├── mkdocs.yml                 # nav tree, theme config, plugins (mike, mermaid2)
└── portal/                    # documentation-portal-specific assets only
    ├── stylesheets/
    │   └── extra.css          # AIOS brand tokens, if any are ever defined
    └── overrides/              # Material theme overrides, if needed
```

**Deliberately not proposed**: moving any existing `docs/*.md` file into a new tree (e.g. a `docs/src/` convention some MkDocs projects use). AIOS's existing `docs/` structure (by phase/capability/concern — `architecture/`, `capabilities/`, `certification/`, `execution/`, `governance/`, `strategy/`) already matches how this repository's own governance model organizes information, and MkDocs can build directly from it via `mkdocs.yml`'s `docs_dir` pointing at the existing `docs/` tree — no file needs to move for the portal to work.

## Migration plan (when authorized — not started)

1. Add `mkdocs.yml` at the repository root (or `docs/mkdocs.yml` with `docs_dir: .` relative adjustment), with `plugins: [mike, mermaid2]` and Material theme configured.
2. Add a `docs-portal.yml` GitHub Actions workflow (separate from the documentation-quality workflows already added — see [Workstream 9](../.github/workflows/)) that runs `mkdocs gh-deploy` on tagged releases only, not on every `main` push, to keep the portal's version history aligned with real release tags (per [`release-strategy.md`](release-strategy.md)).
3. Verify every existing relative Markdown link still resolves under MkDocs' own link-checking (`mkdocs build --strict`) before the first real deploy.
4. Publish the first version under `mike` as the version corresponding to the first real tagged release — never publish a portal version for `main`/development state as if it were a release.
5. Add the live portal URL to the root README once a first version is actually deployed — not before.

## Navigation tree (draft, for the eventual `mkdocs.yml`)

```yaml
nav:
  - Home: README.md
  - Current Program Status: README.md#current-program-status
  - Architecture:
      - Foundation Specification: architecture/AIOS_FOUNDATION_ARCHITECTURE_SPECIFICATION_V1.md
      - Reference Architecture: architecture/AIOS_REFERENCE_ARCHITECTURE_V1.md
      - C4 Model:
          - Overview: architecture/c4/README.md
          - System Context: architecture/c4/level1-system-context.md
          - Container: architecture/c4/level2-container.md
          - Operational Core: architecture/c4/level3-operational-core.md
          - DGX AI Platform: architecture/c4/level3-dgx-ai-platform.md
          - Web Portal: architecture/c4/level3-web-portal.md
          - Knowledge Platform: architecture/c4/level3-knowledge-platform.md
          - Integration Layer: architecture/c4/level3-integration-layer.md
      - ADRs: adr/README.md
  - Governance:
      - Capability Governance Standard: governance/AIOS_CAPABILITY_GOVERNANCE_STANDARD_V1.md
  - Capabilities:
      - DGX 2.0 Demand Forecasting: capabilities/DGX_2_DEMAND_FORECASTING_SPECIFICATION_V1.md
  - Certification:
      - DGX 2.0 Certification Standard v1.0: certification/DGX2_DEMAND_FORECASTING_CERTIFICATION_STANDARD_V1.md
      - Amendment v1.1: certification/DGX2_CERTIFICATION_STANDARD_AMENDMENT_V1_1.md
  - Execution:
      - Phase II Engineering Execution Program: execution/AIOS_PHASE_II_ENGINEERING_EXECUTION_PROGRAM_V1.md
      - DGX 2.0 Phase A Baseline 1.0: execution/DGX2_PHASE_A_BASELINE_1_0.md
  - Strategy:
      - Enterprise Roadmap: strategy/AIOS_ENTERPRISE_ROADMAP_V1.md
  - Release Strategy: release-strategy.md
  - Contributing: ../CONTRIBUTING.md
  - Changelog: ../CHANGELOG.md
```

This tree is illustrative of intended structure, not a final, exhaustive nav — the real corpus (`docs/ai/`, `docs/ai-evaluation/`, `docs/ai-tuning/`, `docs/knowledge-platform/`, `docs/trusted-knowledge-pilot/`, `docs/retrieval-intelligence/`, `docs/data-consolidation/`, `docs/data-readiness/`, `docs/data-sources/`) would be added as further top-level sections when the portal is actually implemented.
