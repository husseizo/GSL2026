import { isGenericCustomerCode, normalizeCompanyName, normalizePhone, normalizeTaxNumber } from './normalize';

describe('normalizePhone', () => {
  it('strips formatting but keeps a leading +', () => {
    expect(normalizePhone('+255 712 345 678')).toBe('+255712345678');
    expect(normalizePhone('+255712345678')).toBe('+255712345678');
  });

  it('returns null for blank/absent input', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });
});

describe('normalizeCompanyName', () => {
  it('lowercases and strips common legal-entity suffixes', () => {
    expect(normalizeCompanyName('ABC Motors Ltd.')).toBe('abc motors');
    expect(normalizeCompanyName('abc motors limited')).toBe('abc motors');
  });

  it('collapses whitespace', () => {
    expect(normalizeCompanyName('  ABC   Motors  ')).toBe('abc motors');
  });

  it('returns null for blank/absent input', () => {
    expect(normalizeCompanyName(null)).toBeNull();
    expect(normalizeCompanyName('')).toBeNull();
  });
});

describe('normalizeTaxNumber', () => {
  it('strips punctuation and uppercases', () => {
    expect(normalizeTaxNumber('tin-123-456')).toBe('TIN123456');
  });

  it('returns null for blank/absent input', () => {
    expect(normalizeTaxNumber(null)).toBeNull();
  });
});

describe('isGenericCustomerCode', () => {
  it('flags known walk-in/generic codes seen in real MolasCacheDb data', () => {
    expect(isGenericCustomerCode('0001')).toBe(true);
    expect(isGenericCustomerCode('b00000000')).toBe(true);
    expect(isGenericCustomerCode('C10004')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isGenericCustomerCode('B00000000')).toBe(true);
  });

  it('returns false for null/absent input', () => {
    expect(isGenericCustomerCode(null)).toBe(false);
  });
});
