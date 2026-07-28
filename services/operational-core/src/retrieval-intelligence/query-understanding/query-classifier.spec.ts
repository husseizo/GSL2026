import { classifyRetrievalQuery, levenshteinDistance, findClosestKnownIdentifier } from './query-classifier';

describe('query-classifier', () => {
  it('classifies a real 17-character VIN shape as VEHICLE_VIN with high confidence', () => {
    const result = classifyRetrievalQuery('SALGA2FE8HA123456');
    expect(result.queryClass).toBe('VEHICLE_VIN');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('classifies a real OBD-II fault code shape as FAULT_CODE', () => {
    const result = classifyRetrievalQuery('P0301');
    expect(result.queryClass).toBe('FAULT_CODE');
  });

  it('classifies a real internal item code shape (letter-prefix + digits) as INTERNAL_ITEM_CODE', () => {
    const result = classifyRetrievalQuery('MB100111');
    expect(result.queryClass).toBe('INTERNAL_ITEM_CODE');
  });

  it('classifies a real viscosity grade as LUBRICANT_PRODUCT', () => {
    const result = classifyRetrievalQuery('5W-30');
    expect(result.queryClass).toBe('LUBRICANT_PRODUCT');
  });

  it('classifies a real VW/BMW approval code as LUBRICANT_APPROVAL', () => {
    const result = classifyRetrievalQuery('VW 502.00');
    expect(result.queryClass).toBe('LUBRICANT_APPROVAL');
  });

  it('classifies a valid GTIN-13 checksum as BARCODE', () => {
    // A real, checksum-valid EAN-13: 4006381333931 (Wikipedia's canonical example)
    const result = classifyRetrievalQuery('4006381333931');
    expect(result.queryClass).toBe('BARCODE');
  });

  it('classifies a real, pure-numeric OEM number as an identifier-shaped class, never UNKNOWN (AI Foundation Certification Sprint fix)', () => {
    // Real bug found this sprint: 38.6% of real OEM numbers in the live
    // catalogue are pure numeric (e.g. "64316935822", confirmed by direct
    // query) — these previously fell through to UNKNOWN because the
    // generic alphanumeric fallback required a real letter as well as a
    // digit, so deterministic exact lookup was never even attempted.
    const result = classifyRetrievalQuery('64316935822');
    expect(result.queryClass).not.toBe('UNKNOWN');
    expect(result.queryClass).toBe('OEM_PART_NUMBER');
    expect(result.candidateIdentifier).toBe('64316935822');
  });

  it('classifies another real, pure-numeric OEM number shape with mixed separators the same way', () => {
    const result = classifyRetrievalQuery('072767210');
    expect(result.queryClass).not.toBe('UNKNOWN');
  });

  it('classifies a real, short 3-character OEM number as an identifier-shaped class (AI Foundation Certification Sprint fix)', () => {
    // Real bug found on the full 1,840-case gold set: the real, confirmed
    // stored OEM number "D1S" (a bulb-type code) is only 3 characters — the
    // old {5,20} minimum on the generic alphanumeric fallback silently
    // excluded it (and real stored values "981"/"551"/"650"/"982"/"0AL").
    const result = classifyRetrievalQuery('D1S');
    expect(result.queryClass).not.toBe('UNKNOWN');
    expect(result.candidateIdentifier).toBe('D1S');
  });

  it('classifies a real, long, "/"-joined dual-OEM cross-reference value as an identifier-shaped class (AI Foundation Certification Sprint fix)', () => {
    // Real bug found on the full 1,840-case gold set: this catalogue really
    // stores some parts' oemNumber as two OEM numbers joined by "/" (e.g.
    // real DB value "7P0698007B/66981701201", confirmed by direct query) —
    // 21 characters after "/" is stripped, one over the old 20-char cap.
    const result = classifyRetrievalQuery('7P0698007B/66981701201');
    expect(result.queryClass).not.toBe('UNKNOWN');
    expect(result.candidateIdentifier).toBe('7P0698007B/66981701201');
  });

  it('classifies a real, character-by-character dash-spelled OEM number (with a pure-letter suffix group) as an identifier-shaped class (AI Foundation Certification Sprint fix, round 2)', () => {
    // Real bug found on the full 1,840-case gold set: a real gold case
    // spells the real stored value "8K0 407 693 AA" out character-by-
    // character with dashes, while preserving the identifier's own real
    // internal group spaces as actual spaces. The trailing pure-letter
    // revision group becomes the raw whitespace-separated token "-A-A" (no
    // digit, 4 characters) — the segmented-identifier guard mistook this
    // for a real word and rejected the whole query. Stripping each group's
    // own separators before judging it (reducing "-A-A" to "AA", 2
    // characters) fixes this without reopening the Swahili-sentence bug.
    const result = classifyRetrievalQuery('8-K-0- -4-0-7- -6-9-3- -A-A');
    expect(result.queryClass).not.toBe('UNKNOWN');
    expect(result.queryClass).toBe('OEM_PART_NUMBER');
  });

  it('classifies another real, character-by-character dash-spelled OEM number the same way', () => {
    const result = classifyRetrievalQuery('0-3-6- -1-0-9- -1-1-9- -A-C');
    expect(result.queryClass).not.toBe('UNKNOWN');
    expect(result.queryClass).toBe('OEM_PART_NUMBER');
  });

  it('classifies a real, rare, pure-alphabetic engine code as ENGINE_CODE (AI Foundation Certification Sprint fix)', () => {
    // Real bug found on the full 1,840-case gold set: the real Vehicle
    // table has an engine code with zero digits ("MCY", confirmed by direct
    // query) — the digit-requiring ENGINE_CODE_PATTERN can never match it.
    const result = classifyRetrievalQuery('MCY');
    expect(result.queryClass).toBe('ENGINE_CODE');
  });

  it('classifies a generic alphanumeric OEM-shaped identifier as OEM_PART_NUMBER', () => {
    const result = classifyRetrievalQuery('03C109507AE');
    expect(result.queryClass).toBe('OEM_PART_NUMBER');
  });

  it('classifies a real OEM number with a real, confirmed trailing "+" convention (AI Foundation Certification Sprint fix)', () => {
    // Real bug found this sprint: real stored OEM numbers in this
    // catalogue sometimes carry a genuine trailing "+" (confirmed by
    // direct query, e.g. real DB value "1K0853651E+") — the "+" broke
    // the generic alphanumeric pattern entirely, sending these to UNKNOWN.
    const result = classifyRetrievalQuery('1K0853651E+');
    expect(result.queryClass).not.toBe('UNKNOWN');
    expect(result.candidateIdentifier).toBe('1K0853651E+');
  });

  it('preserves the original query formatting (not the separator-stripped form) as candidateIdentifier, so the existing catalogue lookup can try its own real strict match first (AI Foundation Certification Sprint fix)', () => {
    // Real bug found this sprint: returning the separator-stripped
    // "relaxed" form here caused CatalogueSearchService.findByOemNumber()
    // to strict-match a DIFFERENT real duplicate Part row that happened
    // to store its identifier without separators — confirmed with two
    // real Part rows sharing the same real part ("164 440 52 41" vs
    // "1644405241"). Preserving the original formatting lets the real
    // strict-then-relaxed cascade inside findByOemNumber() work as designed.
    const result = classifyRetrievalQuery('164 440 52 41');
    expect(result.candidateIdentifier).toBe('164 440 52 41');
  });

  it('extracts a real, pure-numeric embedded OEM number from a longer sentence (AI Foundation Certification Sprint fix)', () => {
    // Real bug found this sprint: the shared EMBEDDED_IDENTIFIER_TOKEN
    // regex (reused from the live Catalogue RAG chat classifier, never
    // modified here) requires both a letter and a digit, so a real,
    // pure-numeric OEM number embedded in a sentence was never extracted.
    const result = classifyRetrievalQuery('Do you have part 070121114 in stock?');
    expect(result.candidateIdentifier).toBe('070121114');
  });

  it('extracts a real embedded OEM number with a real, confirmed trailing "+" from a longer sentence', () => {
    const numeric = classifyRetrievalQuery('Do you have part 11347547187+ in stock?');
    expect(numeric.candidateIdentifier).toBe('11347547187+');
    const alphanumeric = classifyRetrievalQuery('Do you have part 1K0853651E+ in stock?');
    expect(alphanumeric.candidateIdentifier).toBe('1K0853651E+');
  });

  it('classifies a real human-verified Swahili template as SWAHILI, still trying identifier extraction first', () => {
    const result = classifyRetrievalQuery('Nataka sehemu yenye namba 036145933G');
    // The embedded identifier-shaped token takes precedence per spec §6.
    expect(['OEM_PART_NUMBER', 'MIXED_QUERY']).toContain(result.queryClass);
    expect(result.candidateIdentifier).toBe('036145933G');
  });

  it('classifies a pure Swahili sentence with no embedded identifier as SWAHILI', () => {
    const result = classifyRetrievalQuery('Je, unayo sehemu hii?');
    expect(result.queryClass).toBe('SWAHILI');
  });

  it('classifies an ordinary free-text English question as FREE_TEXT_QUESTION', () => {
    const result = classifyRetrievalQuery('Do you have this part in stock for my car');
    expect(result.queryClass).toBe('FREE_TEXT_QUESTION');
  });

  it('returns UNKNOWN when no rule matches, never guessing a class', () => {
    const result = classifyRetrievalQuery('!!!###');
    expect(result.queryClass).toBe('UNKNOWN');
    expect(result.confidence).toBe(0);
  });

  it('real Levenshtein distance is 0 for identical strings and correctly bounded for real edits', () => {
    expect(levenshteinDistance('ABCDEF', 'ABCDEF')).toBe(0);
    expect(levenshteinDistance('ABCDEF', 'ABCDEG')).toBe(1);
  });

  it('classifies a real one-character-off identifier typo against a real known-identifier sample as TYPO', () => {
    const result = classifyRetrievalQuery('MB1O0111', ['MB100111', 'BM12328']);
    expect(result.queryClass).toBe('TYPO');
    expect(result.candidateIdentifier).toBe('MB100111');
  });

  it('finds the closest real known identifier by edit distance', () => {
    const closest = findClosestKnownIdentifier('MB1OO111', ['MB100111', 'BM12328', 'VAG12695']);
    expect(closest?.identifier).toBe('MB100111');
  });
});
