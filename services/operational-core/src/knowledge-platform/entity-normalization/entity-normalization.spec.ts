import { normalizeViscosityGrade, normalizePartNumber, parseTorqueValue, parseFluidQuantity, distinguishApprovalVsRecommendation, distinguishFitmentVsCompatibility, distinguishSupersessionVsAlternative } from './entity-normalization';

describe('entity-normalization', () => {
  it('preserves the original viscosity grade verbatim while producing a real matching key (5W-30 must not become 5W30 in the stored value)', () => {
    const result = normalizeViscosityGrade('5W-30');
    expect(result.original).toBe('5W-30');
    expect(result.normalized).toBe('5W30');
  });

  it('normalizes a real part number for matching while preserving the original', () => {
    const result = normalizePartNumber('AB-1234 X');
    expect(result.original).toBe('AB-1234 X');
    expect(result.normalized).toBe('AB1234X');
  });

  it('parses a real torque value with its unit, preserving the original string', () => {
    const result = parseTorqueValue('Tighten to 45 Nm');
    expect(result?.original).toBe('Tighten to 45 Nm');
    expect(result?.normalized).toEqual({ value: 45, unit: 'nm' });
  });

  it('returns null for text with no real torque value, never fabricating one', () => {
    expect(parseTorqueValue('No numeric value here')).toBeNull();
  });

  it('parses a real fluid quantity', () => {
    const result = parseFluidQuantity('Fill with 4.5L of oil');
    expect(result?.normalized).toEqual({ value: 4.5, unit: 'l' });
  });

  it('keeps approval and recommendation distinct, never conflating them', () => {
    expect(distinguishApprovalVsRecommendation('This product has official approval for this application.')).toBe('APPROVAL');
    expect(distinguishApprovalVsRecommendation('This product is recommended for this application.')).toBe('RECOMMENDATION');
    expect(distinguishApprovalVsRecommendation('No signal here.')).toBe('UNKNOWN');
  });

  it('keeps fitment and compatibility distinct', () => {
    expect(distinguishFitmentVsCompatibility('This part fits the 2018 model.')).toBe('FITMENT');
    expect(distinguishFitmentVsCompatibility('This part is compatible with the 2018 model.')).toBe('COMPATIBILITY');
  });

  it('keeps supersession and alternative distinct', () => {
    expect(distinguishSupersessionVsAlternative('This part supersedes the old part number.')).toBe('SUPERSESSION');
    expect(distinguishSupersessionVsAlternative('This part is an alternative to the original.')).toBe('ALTERNATIVE');
  });
});
