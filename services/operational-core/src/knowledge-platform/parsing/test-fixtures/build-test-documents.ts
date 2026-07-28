// DGX Prototype 1.7.1 — real, genuinely-authored small PDF/DOCX binaries
// for tests and the verify script (no PDF/DOCX files exist anywhere in
// this repo to reuse — see docs/trusted-knowledge-pilot/pdf-ingestion.md).
// Built with real, well-tested generator libraries (pdfkit, docx) rather
// than a hand-rolled byte template — a hand-written minimal PDF proved
// fragile at some text lengths during this phase's own real testing.
import PDFDocument from 'pdfkit';
import { Document, Paragraph, HeadingLevel, Table, TableRow, TableCell, TextRun, Packer } from 'docx';

export function buildMinimalTestPdf(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [300, 200] });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(18).text(text, 10, 50);
    doc.end();
  });
}

export async function buildMinimalTestDocx(headingText: string, bodyText: string, tableData?: { headers: string[]; rows: string[][] }): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [new Paragraph({ text: headingText, heading: HeadingLevel.HEADING_1 }), new Paragraph({ children: [new TextRun(bodyText)] })];

  if (tableData) {
    children.push(
      new Table({
        rows: [tableData.headers, ...tableData.rows].map(
          (cells) =>
            new TableRow({
              children: cells.map((text) => new TableCell({ children: [new Paragraph(text)] })),
            }),
        ),
      }),
    );
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
