import { validatePasswordPolicy } from './password-policy';

describe('validatePasswordPolicy', () => {
  it('accepts a password satisfying every rule', () => {
    const result = validatePasswordPolicy('Str0ng!Passw0rd');
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('rejects a password below the minimum length', () => {
    const result = validatePasswordPolicy('Sh0rt!');
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes('12 characters'))).toBe(true);
  });

  it('rejects a password with no uppercase letter', () => {
    expect(validatePasswordPolicy('lowercase123!only').violations).toContain('Password must contain an uppercase letter');
  });

  it('rejects a password with no digit', () => {
    expect(validatePasswordPolicy('NoDigitsHere!!').violations).toContain('Password must contain a digit');
  });

  it('rejects a password with no special character', () => {
    expect(validatePasswordPolicy('NoSpecialChar123').violations).toContain('Password must contain a special character');
  });

  it('reports every violated rule at once, not just the first', () => {
    const result = validatePasswordPolicy('short');
    expect(result.violations.length).toBeGreaterThan(1);
  });
});
