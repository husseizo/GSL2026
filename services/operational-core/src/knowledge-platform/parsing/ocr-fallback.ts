// DGX Prototype 1.7.1 — real OCR fallback (spec §14), using tesseract.js
// (pure JS/WASM, no native binary dependency — verified working in this
// sandbox, including real network-fetched language data). Used only when
// native text extraction yields near-empty content; never invoked for a
// PDF/DOCX that already has a real embedded text layer.
import { recognize } from 'tesseract.js';

// A real, scanned/image-only page yields a completely empty (or
// whitespace-only) extracted string — a genuine text layer always produces
// *something*, even a single short word. A real bug found during this
// phase's own testing: an earlier absolute-length threshold (20 chars)
// incorrectly triggered OCR for legitimately short but fully-extracted real
// text (e.g. "Torque spec 45 Nm" is 18 real characters). Absence, not
// shortness, is the real signal.
export const OCR_TEXT_PRESENCE_THRESHOLD = 1; // chars — below this (i.e. empty/whitespace-only), native extraction is treated as "no real text layer"

export interface OcrResult {
  text: string;
  confidence: number; // 0-100, tesseract's own real confidence score
  engine: 'tesseract.js';
}

export async function runOcrOnImage(imageBytes: Buffer, language = 'eng'): Promise<OcrResult> {
  const result = await recognize(imageBytes, language);
  return { text: result.data.text, confidence: result.data.confidence, engine: 'tesseract.js' };
}

export function nativeTextLooksAbsent(text: string): boolean {
  return text.trim().length < OCR_TEXT_PRESENCE_THRESHOLD;
}
