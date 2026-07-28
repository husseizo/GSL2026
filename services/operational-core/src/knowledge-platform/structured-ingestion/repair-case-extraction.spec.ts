import { classifyDiagnosticSession, classifyInspectionResult, buildDiagnosticSessionSummaryText, buildInspectionResultSummaryText } from './repair-case-extraction';

describe('repair-case-extraction', () => {
  describe('classifyDiagnosticSession', () => {
    it('classifies a completed session with real codes and notes as VERIFIED_RESOLUTION', () => {
      const result = classifyDiagnosticSession({ id: 's1', completedAt: new Date(), notes: 'Replaced faulty coil pack.', codes: [{ code: 'P0301', description: 'Cylinder 1 misfire' }] });
      expect(result).toBe('VERIFIED_RESOLUTION');
    });

    it('classifies an incomplete session as INSUFFICIENT_EVIDENCE, never overriding official guidance by default', () => {
      const result = classifyDiagnosticSession({ id: 's2', completedAt: null, notes: null, codes: [] });
      expect(result).toBe('INSUFFICIENT_EVIDENCE');
    });
  });

  describe('classifyInspectionResult', () => {
    it('classifies a FAIL with a real safety warning as WARRANTY_CASE', () => {
      expect(classifyInspectionResult({ id: 'i1', finding: 'FAIL', severity: 'CRITICAL', recommendedAction: 'Replace brake pads', safetyWarning: true, note: null })).toBe('WARRANTY_CASE');
    });

    it('classifies NOT_INSPECTED as INSUFFICIENT_EVIDENCE', () => {
      expect(classifyInspectionResult({ id: 'i2', finding: 'NOT_INSPECTED', severity: 'NONE', recommendedAction: null, safetyWarning: false, note: null })).toBe('INSUFFICIENT_EVIDENCE');
    });
  });

  it('summary text builders produce non-empty real text from real fields', () => {
    expect(buildDiagnosticSessionSummaryText({ id: 's1', completedAt: new Date(), notes: 'Fixed.', codes: [{ code: 'P0301', description: null }] })).toContain('P0301');
    expect(buildInspectionResultSummaryText({ id: 'i1', finding: 'FAIL', severity: 'HIGH', recommendedAction: 'Replace', safetyWarning: true, note: null })).toContain('FAIL');
  });
});
