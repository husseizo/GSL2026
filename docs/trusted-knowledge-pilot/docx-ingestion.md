# Real DOCX Ingestion

## Implementation

`src/knowledge-platform/parsing/parsers/docx.parser.ts` was fully rewritten this phase using `mammoth` (`convertToHtml({ buffer })`). `parseDocx(raw: Buffer, fallbackTitle: string): Promise<ParsedDocument>` extracts headings, ordered paragraphs, and tables:

- Headings and paragraph order are preserved exactly as authored (`extractOrderedSections()`, regex-based over the real HTML mammoth produces).
- Tables are **never flattened** into prose — `extractTables()` preserves row/column structure as structured data, matching the spec's explicit requirement.

## Real test fixtures

`buildMinimalTestDocx(headingText, bodyText, tableData?)` (`test-fixtures/build-test-documents.ts`) generates real, valid `.docx` binaries using the `docx` library (`Document`, `Paragraph`, `HeadingLevel`, `Table`, `TableRow`, `TableCell`, `TextRun`, `Packer`) — genuinely self-authored technical content, not sourced externally.

## Verification

`pdf-pipeline.integration-spec.ts` (despite its name, covers both formats) runs a real DOCX fixture with a table through the full ingestion pipeline, asserting the table survives as structured data rather than flattened text. Same Jest-project isolation as PDF (see [pdf-ingestion.md](pdf-ingestion.md)) applies, since `mammoth`'s dependency chain shares the same ESM constraints.
