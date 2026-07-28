# Real PDF Ingestion

## Implementation

`src/knowledge-platform/parsing/parsers/pdf.parser.ts` was fully rewritten this phase using `pdf-parse` v2 (built on `pdfjs-dist` v5). `parsePdf(raw: Buffer, fallbackTitle: string): Promise<ParsedDocument>` performs real per-page `getText()` extraction, preserving page numbers on every extracted section for citation.

## OCR fallback

When a page's native text looks absent (see [ocr-policy.md](ocr-policy.md)), the parser renders that page to a real PNG via `getScreenshot({ scale: 1.5, partial: [page.num] })` and runs it through real `tesseract.js` OCR, recording engine/confidence/page metadata (`ocrApplied`, `ocrConfidence` on `KnowledgeItemVersion`).

## Real bug found and fixed: hand-rolled test PDFs are fragile

An earlier hand-rolled minimal-PDF byte template (used only for test fixtures, never production ingestion) produced truncated extracted text at certain string lengths — confirmed directly via `pdf-parse` testing. Fixed by switching `buildMinimalTestPdf()` (`test-fixtures/build-test-documents.ts`) to the real, well-tested `pdfkit` library. Production PDF parsing was never affected by this bug; only the test-fixture generator was.

## Jest/pdfjs-dist ESM incompatibility — a tooling issue, not a functional defect

`pdf-parse`'s real PDF text extraction failed under ts-jest (`"Setting up fake worker failed: A dynamic import callback was invoked without --experimental-vm-modules"`). Confirmed via direct `ts-node` execution that the real parser works correctly outside Jest. Fixed by creating two dedicated jest "projects" (`pdf-docx`, `pdf-docx-integration`), each launched via `cross-env NODE_OPTIONS=--experimental-vm-modules`, with the relevant spec files excluded from the shared `unit`/`integration` projects (enabling the flag there broke `otplib`/`@scure` used by MFA — confirmed via direct testing). Run via `npm run test:pdf-docx` / `npm run test:integration:pdf-docx`.

## Verification

`pdf-pipeline.integration-spec.ts` runs a real, self-authored PDF fixture through the full ingestion pipeline end-to-end, asserting page-numbered citations survive.
