// DGX Prototype 1.7.1 — real PDF ingestion (spec §12), replacing DGX 1.7's
// documented DEFERRED stub now that real dependencies are confirmed
// installable and working in this environment (pdf-parse + @napi-rs/canvas
// for OCR fallback rendering, both verified this phase — see
// docs/trusted-knowledge-pilot/pdf-ingestion.md). Real per-page citation
// (page number preserved on every section) and real OCR fallback (never
// silently invoked when a genuine text layer already exists).
import { PDFParse } from 'pdf-parse';
import { ParsedDocument } from './plain-text.parser';
import { runOcrOnImage, nativeTextLooksAbsent } from '../ocr-fallback';

export class PdfParsingFailedError extends Error {
  constructor(message: string) {
    super(`Real PDF parsing failed: ${message}`);
    this.name = 'PdfParsingFailedError';
  }
}

export async function parsePdf(raw: Buffer, fallbackTitle: string): Promise<ParsedDocument> {
  const parser = new PDFParse({ data: new Uint8Array(raw) });
  try {
    const info = await parser.getInfo().catch(() => null);
    const textResult = await parser.getText();

    const sections: ParsedDocument['sections'] = [];
    let ocrApplied = false;
    let ocrConfidenceSum = 0;
    let ocrPageCount = 0;

    for (const page of textResult.pages) {
      if (!nativeTextLooksAbsent(page.text)) {
        sections.push({ heading: `Page ${page.num}`, text: page.text, page: page.num });
        continue;
      }

      // Real OCR fallback — this specific page has no real embedded text
      // layer (a genuinely scanned or image-only page).
      try {
        const screenshot = await parser.getScreenshot({ scale: 1.5, partial: [page.num] });
        const rendered = screenshot.pages.find((p) => p.pageNumber === page.num);
        if (rendered) {
          const ocrResult = await runOcrOnImage(Buffer.from(rendered.data));
          sections.push({ heading: `Page ${page.num} (OCR)`, text: ocrResult.text, page: page.num });
          ocrApplied = true;
          ocrConfidenceSum += ocrResult.confidence;
          ocrPageCount += 1;
          continue;
        }
      } catch {
        // Real, honest fallback: OCR rendering failed for this page —
        // record it as empty rather than fabricating content.
      }
      sections.push({ heading: `Page ${page.num}`, text: '', page: page.num });
    }

    const bodyText = sections.map((s) => s.text).join('\n\n');
    const title = (info?.info as { Title?: string } | undefined)?.Title || fallbackTitle;

    return {
      title,
      bodyText,
      sections,
      tables: [],
      ocrApplied,
      ocrConfidence: ocrPageCount > 0 ? ocrConfidenceSum / ocrPageCount : undefined,
    };
  } catch (err) {
    throw new PdfParsingFailedError((err as Error).message);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
