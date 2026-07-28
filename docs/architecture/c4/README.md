# AIOS C4 Architecture Model

This directory holds the C4 model (Context, Container, Component) for AIOS, layered on top of — and never contradicting — [`AIOS_FOUNDATION_ARCHITECTURE_SPECIFICATION_V1.md`](../AIOS_FOUNDATION_ARCHITECTURE_SPECIFICATION_V1.md) and [`AIOS_REFERENCE_ARCHITECTURE_V1.md`](../AIOS_REFERENCE_ARCHITECTURE_V1.md). These diagrams are a visual index into that prose, not a replacement for it — where a diagram and the Foundation/Reference Architecture text disagree, the text wins.

## Notation decision: Mermaid flowcharts, not Mermaid's native C4 macros or PlantUML C4

**Decision**: every diagram in this directory is a standard Mermaid `flowchart`, styled to express C4 levels (Context/Container/Component), rather than Mermaid's dedicated `C4Context`/`C4Container`/`C4Component` diagram types, or PlantUML's C4 library.

**Why**:
- Every existing architecture diagram in this repository (`docs/architecture/*.md`, `docs/strategy/AIOS_ENTERPRISE_ROADMAP_V1.md`) already uses Mermaid `flowchart`/`gantt` blocks. Using the same notation keeps this directory visually and syntactically consistent with the rest of the documentation set, rather than introducing a second diagramming dialect.
- Mermaid's native C4 diagram types render inconsistently across GitHub's built-in Markdown preview and common documentation tooling as of this writing — a plain `flowchart` is the notation with the widest, most reliable rendering support in exactly the places this repository is read (GitHub, a future documentation portal — see [Documentation Portal Decision](../../documentation-portal-decision.md)).
- PlantUML's C4 library produces the most visually authentic C4 diagrams, but requires a PlantUML rendering toolchain (server or CLI) that is not part of this repository's current tooling, and would add an external rendering dependency for a documentation-only benefit. If a future documentation portal (see the Decision Record) adopts a PlantUML renderer, this decision should be revisited — not before.

Each diagram below is still explicitly labeled with its C4 level in its own heading and file name, so the *information* C4 provides (which level of zoom you're looking at) is preserved even though the notation is a plain flowchart.

## Diagrams in this directory

| Level | Diagram | File |
|---|---|---|
| 1 | System Context | [level1-system-context.md](level1-system-context.md) |
| 2 | Container | [level2-container.md](level2-container.md) |
| 3 | Operational Core (component) | [level3-operational-core.md](level3-operational-core.md) |
| 3 | DGX AI Platform (component) | [level3-dgx-ai-platform.md](level3-dgx-ai-platform.md) |
| 3 | Web Portal (component) | [level3-web-portal.md](level3-web-portal.md) |
| 3 | Knowledge Platform (component) | [level3-knowledge-platform.md](level3-knowledge-platform.md) |
| 3 | Integration Layer (component) | [level3-integration-layer.md](level3-integration-layer.md) |

## Maintenance

These diagrams describe **structure** (what talks to what, and through which boundary) — they deliberately do not encode maturity/certification status (see the [Current Program Status](../../../README.md#current-program-status) table for that, which changes independently of architecture). A diagram in this directory should be updated only when a real container or component boundary actually changes — never to reflect a certification verdict, a roadmap date, or a capability's maturity level.

## Validation

All 7 diagrams in this directory (System Context, Container, and the 5 Component views) have been rendered and confirmed valid using real `mermaid-cli` (`mmdc`) v11.16.0 — 0 rendering failures. This is re-checked automatically by [`.github/workflows/docs-mermaid-check.yml`](../../../.github/workflows/docs-mermaid-check.yml) on every documentation change.

**Platform-specific validation note**: the underlying script, [`scripts/ci/validate-mermaid-blocks.py`](../../../scripts/ci/validate-mermaid-blocks.py), invokes `subprocess.run(["mmdc", ...])` directly. On Windows, this fails to resolve `mmdc`'s `npm`-installed command wrapper without `shell=True` (a real, observed limitation in this repository's own Windows development environment). The GitHub Actions workflow runs on a Linux runner, where a globally `npm install -g`'d `mmdc` resolves normally on `PATH` without this issue — so the CI workflow itself is unaffected. This is recorded here as a known platform difference, not changed in the script itself, since the script's actual execution environment (GitHub Actions, Linux) does not exhibit it.
