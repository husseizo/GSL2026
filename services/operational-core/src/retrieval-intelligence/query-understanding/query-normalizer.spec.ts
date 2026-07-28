import { normalizeRetrievalQuery, applyOcrConfusionVariant, expandTechnicianAbbreviations } from './query-normalizer';

describe('query-normalizer', () => {
  it('resolves real formatting variations of the same OEM number to the same canonical relaxed form (spec §5)', () => {
    const variants = ['03L115562', '03L 115 562', '03-L-115562', '03l115562'];
    const relaxedForms = variants.map((v) => normalizeRetrievalQuery(v).relaxed);
    expect(new Set(relaxedForms).size).toBe(1);
    expect(relaxedForms[0]).toBe('03L115562');
  });

  it('always preserves the original query verbatim alongside every normalized variant', () => {
    const result = normalizeRetrievalQuery('03-L-115562');
    expect(result.original).toBe('03-L-115562');
  });

  it('applies a real, opt-in OCR-confusion variant, never mutating the canonical relaxed form', () => {
    const result = normalizeRetrievalQuery('03-L-115562');
    expect(result.relaxed).toBe('03L115562');
    expect(result.ocrCorrected).toBe('031115562');
  });

  it('OCR-confusion mapping swaps O->0, I/L->1, S->5, B->8 deterministically', () => {
    expect(applyOcrConfusionVariant('OIL5B')).toBe('01158');
  });

  it('expands real technician abbreviations word-by-word, never corrupting substrings inside longer tokens', () => {
    expect(expandTechnicianAbbreviations('eng torq spec')).toBe('engine torque spec');
    expect(expandTechnicianAbbreviations('engineering')).toBe('engineering');
  });
});
