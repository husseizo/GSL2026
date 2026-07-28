# Ingestion Format Scope

> **Superseded by DGX Prototype 1.7.1.** PDF and DOCX parsing, deferred below when this document was originally written (DGX Prototype 1.7), are now real — see [`docs/trusted-knowledge-pilot/pdf-ingestion.md`](../trusted-knowledge-pilot/pdf-ingestion.md) and [`docs/trusted-knowledge-pilot/docx-ingestion.md`](../trusted-knowledge-pilot/docx-ingestion.md). This file is retained for historical accuracy about what DGX 1.7 shipped, not as current scope documentation — do not treat `DEFERRED_FORMATS` below as still accurate.

`parseByFormat()` (`src/knowledge-platform/parsing/parser-registry.ts`) dispatches by format at runtime and never silently swallows an unsupported one.

## Real as of DGX Prototype 1.7 — zero new dependencies

`REAL_FORMATS` originally covered `['text', 'markdown', 'html', 'csv', 'json']`. Every one of these parsers is implemented with no new `package.json` dependency, matching `src/embeddings/chunking.ts`'s existing zero-dependency-parsing precedent:

- **plain text**: paragraph/line-based sectioning.
- **markdown**: heading-based sectioning (`#`/`##`), no external Markdown library.
- **html**: tag-strip + heading structure, no headless browser.
- **csv**: real tabular parsing into `parsed.tables`.
- **json**: structural field extraction into body text.

## No longer deferred — real as of DGX Prototype 1.7.1

`DEFERRED_FORMATS` is now empty. `parsePdf()` (real `pdf-parse` + real `tesseract.js` OCR fallback) and `parseDocx()` (real `mammoth`) both perform genuine extraction — see the linked docs above for implementation detail, real bugs found and fixed, and real usage counts against the live corpus.

This proves the full ingestion pipeline mechanics (checksum/dedup/version-detect/classify/review/publish/snapshot) end-to-end on every one of the 7 supported formats, including the two binary formats that were previously stubbed.
