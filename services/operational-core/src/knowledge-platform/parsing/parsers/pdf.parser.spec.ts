// DGX Prototype 1.7.1 — real PDF/DOCX parsing (replaces the DGX 1.7
// DEFERRED-error tests now that both formats are real — see
// docs/trusted-knowledge-pilot/pdf-ingestion.md / docx-ingestion.md).
import { parsePdf, PdfParsingFailedError } from './pdf.parser';
import { parseDocx, DocxParsingFailedError } from './docx.parser';
import { buildMinimalTestPdf, buildMinimalTestDocx } from '../test-fixtures/build-test-documents';

describe('real PDF parsing', () => {
  it('extracts real embedded text from a real, small PDF', async () => {
    const pdf = await buildMinimalTestPdf('Torque spec 45 Nm');
    const result = await parsePdf(pdf, 'Fallback Title');
    expect(result.bodyText).toContain('Torque spec 45 Nm');
    expect(result.ocrApplied).toBe(false);
  });

  it('preserves a real per-page citation location', async () => {
    const pdf = await buildMinimalTestPdf('Fluid capacity 4.5L');
    const result = await parsePdf(pdf, 'Fallback Title');
    expect(result.sections[0].heading).toBe('Page 1');
    expect(result.sections[0].page).toBe(1);
  });

  it('throws a real, documented error for genuinely corrupt bytes, never a silent no-op', async () => {
    await expect(parsePdf(Buffer.from('not a real pdf at all'), 'Fallback Title')).rejects.toThrow(PdfParsingFailedError);
  });
});

describe('real DOCX parsing', () => {
  it('preserves real headings and paragraph order', async () => {
    const docx = await buildMinimalTestDocx('Lubricant Selection Procedure', 'Use the approved viscosity grade.');
    const result = await parseDocx(docx, 'Fallback Title');
    expect(result.title).toBe('Lubricant Selection Procedure');
    expect(result.bodyText).toContain('Use the approved viscosity grade.');
  });

  it('preserves real tables structurally, never flattened into prose', async () => {
    const docx = await buildMinimalTestDocx('Torque Table', 'See table below.', { headers: ['Fastener', 'Torque (Nm)'], rows: [['Wheel bolt', '110'], ['Sump plug', '35']] });
    const result = await parseDocx(docx, 'Fallback Title');
    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].headers).toEqual(['Fastener', 'Torque (Nm)']);
    expect(result.tables[0].rows).toEqual([['Wheel bolt', '110'], ['Sump plug', '35']]);
  });

  it('throws a real, documented error for genuinely corrupt bytes, never a silent no-op', async () => {
    await expect(parseDocx(Buffer.from('not a real docx at all'), 'Fallback Title')).rejects.toThrow(DocxParsingFailedError);
  });
});
