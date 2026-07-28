import { buildPermissionEnforcementCases, buildSafetyAndPromptInjectionCases, buildSecurityCases, PermissionEnforcementCaseInput, PermissionEnforcementCaseExpected } from './safety-security-cases';
import { ROLE_PERMISSIONS } from '../../common/permissions/role-permissions';

describe('buildPermissionEnforcementCases', () => {
  it('generates real (role, permission) pairs sourced from the actual ROLE_PERMISSIONS map, not fabricated', () => {
    const cases = buildPermissionEnforcementCases(50);
    expect(cases.length).toBeGreaterThan(0);
    expect(cases.length).toBeLessThanOrEqual(50);

    for (const c of cases) {
      const input = c.input as unknown as PermissionEnforcementCaseInput;
      const expected = c.expectedOutput as unknown as PermissionEnforcementCaseExpected;
      const granted = ROLE_PERMISSIONS[input.role] ?? [];
      const actuallyHasIt = input.requiredPermissions.every((p) => (granted as string[]).includes(p));
      expect(actuallyHasIt).toBe(expected.expectedGranted);
    }
  });

  it('includes both deny (expectedGranted: false) and allow (expectedGranted: true) cases', () => {
    const cases = buildPermissionEnforcementCases(50);
    const expectations = cases.map((c) => (c.expectedOutput as unknown as PermissionEnforcementCaseExpected).expectedGranted);
    expect(expectations).toContain(false);
    expect(expectations).toContain(true);
  });
});

describe('buildSafetyAndPromptInjectionCases / buildSecurityCases', () => {
  it('every case expects a refusal, since correctness is structural for adversarial phrasings', () => {
    for (const c of [...buildSafetyAndPromptInjectionCases(), ...buildSecurityCases()]) {
      expect(c.expectedOutput.expectedRefusal).toBe(true);
      expect(c.status).toBe('APPROVED');
    }
  });
});
