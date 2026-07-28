import { SEED_EXTRACTION_PROFILES } from './seed-profiles';

describe('SEED_EXTRACTION_PROFILES', () => {
  it('defines exactly the 11 real document types named in the spec', () => {
    const expected = ['LUBRICANT_TDS', 'LUBRICANT_PDS', 'SAFETY_DATA_SHEET', 'PARTS_CATALOGUE', 'FITMENT_EXPORT', 'TECHNICAL_BULLETIN', 'WORKSHOP_SOP', 'DIAGNOSTIC_PROCEDURE', 'WARRANTY_POLICY', 'INTERNAL_CASE_RECORD', 'PRODUCT_SUPERSESSION_NOTICE'];
    expect(Object.keys(SEED_EXTRACTION_PROFILES).sort()).toEqual(expected.sort());
  });

  it('every profile names at least one real approval role — no profile skips human review entirely', () => {
    for (const [documentType, profile] of Object.entries(SEED_EXTRACTION_PROFILES)) {
      expect(profile.approvalRoles.length).toBeGreaterThan(0);
      void documentType;
    }
  });

  it('high-risk document types (workshop SOP, safety data sheet, warranty) name real high-risk fields or a safety reviewer', () => {
    expect(SEED_EXTRACTION_PROFILES.WORKSHOP_SOP.highRiskFields).toContain('torqueValue');
    expect(SEED_EXTRACTION_PROFILES.SAFETY_DATA_SHEET.approvalRoles).toContain('SAFETY_REVIEWER');
    expect(SEED_EXTRACTION_PROFILES.WARRANTY_POLICY.approvalRoles).toContain('FINAL_APPROVER');
  });
});
