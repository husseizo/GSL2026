import { identifiersMatch, normalizeIdentifierForSearch, stripDocumentedSupplierPrefix } from './identifier-normalization';

describe('normalizeIdentifierForSearch', () => {
  it('preserves the original value unchanged', () => {
    expect(normalizeIdentifierForSearch(' 04E-115-561-H ').original).toBe(' 04E-115-561-H ');
  });

  it('uppercases and trims for the strict form', () => {
    expect(normalizeIdentifierForSearch(' abc-123 ').strict).toBe('ABC-123');
  });

  it('strips spaces/hyphens/dots/slashes for the relaxed form', () => {
    expect(normalizeIdentifierForSearch('04E 115.561/H-1').relaxed).toBe('04E115561H1');
  });

  it('strips leading zeros only for purely numeric relaxed forms', () => {
    expect(normalizeIdentifierForSearch('00123456').leadingZerosStripped).toBe('123456');
  });

  it('never strips leading zeros from an alphanumeric code (would risk merging distinct supplier codes)', () => {
    expect(normalizeIdentifierForSearch('0A1234').leadingZerosStripped).toBe('0A1234');
  });
});

describe('stripDocumentedSupplierPrefix', () => {
  it('returns the input unchanged when no documented prefixes exist', () => {
    expect(stripDocumentedSupplierPrefix('ABC123')).toBe('ABC123');
  });
});

describe('identifiersMatch', () => {
  it('matches identically formatted identifiers at STRICT strength', () => {
    expect(identifiersMatch('ABC123', 'ABC123')).toEqual({ matched: true, strength: 'STRICT' });
  });

  it('matches formatting variations only at RELAXED strength', () => {
    expect(identifiersMatch('04E-115-561-H', '04E115561H')).toEqual({ matched: true, strength: 'RELAXED' });
  });

  it('never merges two genuinely distinct identifiers', () => {
    expect(identifiersMatch('ABC123', 'XYZ789')).toEqual({ matched: false, strength: 'NONE' });
  });

  it('is case-insensitive at STRICT strength', () => {
    expect(identifiersMatch('abc123', 'ABC123')).toEqual({ matched: true, strength: 'STRICT' });
  });
});
