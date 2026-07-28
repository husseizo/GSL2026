import { validateEnv } from './env-validation';

const validConfig = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_SECRET_CURRENT: 'a-sufficiently-long-secret-value',
  JWT_KID_CURRENT: 'k1',
  ENCRYPTION_KEY: 'a-sufficiently-long-encryption-key',
  BRANCH_GATEWAY_SIGNING_KEY: 'a-sufficiently-long-signing-key',
};

describe('validateEnv', () => {
  it('accepts a valid configuration', () => {
    expect(() => validateEnv(validConfig)).not.toThrow();
  });

  it('rejects a configuration missing a required variable', () => {
    const { DATABASE_URL: _unused, ...incomplete } = validConfig;
    expect(() => validateEnv(incomplete)).toThrow('DATABASE_URL');
  });

  it('rejects a JWT secret that is too short to be secure', () => {
    expect(() => validateEnv({ ...validConfig, JWT_SECRET_CURRENT: 'short' })).toThrow('JWT_SECRET_CURRENT');
  });

  it('rejects a malformed DATABASE_URL', () => {
    expect(() => validateEnv({ ...validConfig, DATABASE_URL: 'not-a-url' })).toThrow();
  });

  it('reports every violation at once, not just the first', () => {
    try {
      validateEnv({});
      fail('expected validateEnv to throw');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('DATABASE_URL');
      expect(message).toContain('JWT_SECRET_CURRENT');
      expect(message).toContain('ENCRYPTION_KEY');
    }
  });

  it('allows unknown extra environment variables (not an exhaustive allowlist)', () => {
    expect(() => validateEnv({ ...validConfig, SOME_OTHER_UNRELATED_VAR: 'x' })).not.toThrow();
  });
});
