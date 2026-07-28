// Pure password-strength validation — no DB, no hashing. Deliberately
// simple, explainable rules rather than an entropy-scoring library: a
// reviewer (or a user reading a rejection message) can see exactly which
// rule failed. See docs/architecture/identity-platform.md.
export interface PasswordPolicyResult {
  valid: boolean;
  violations: string[];
}

const MIN_LENGTH = 12;

export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  const violations: string[] = [];

  if (password.length < MIN_LENGTH) violations.push(`Password must be at least ${MIN_LENGTH} characters`);
  if (!/[a-z]/.test(password)) violations.push('Password must contain a lowercase letter');
  if (!/[A-Z]/.test(password)) violations.push('Password must contain an uppercase letter');
  if (!/[0-9]/.test(password)) violations.push('Password must contain a digit');
  if (!/[^a-zA-Z0-9]/.test(password)) violations.push('Password must contain a special character');

  return { valid: violations.length === 0, violations };
}
