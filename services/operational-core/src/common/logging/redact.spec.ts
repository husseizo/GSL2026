import { redactSensitiveFields } from './redact';

describe('redactSensitiveFields', () => {
  it('redacts a top-level password field', () => {
    const result = redactSensitiveFields({ email: 'a@b.com', password: 'hunter2' }) as Record<string, unknown>;
    expect(result.password).toBe('[REDACTED]');
    expect(result.email).toBe('a@b.com');
  });

  it('redacts nested sensitive fields at any depth', () => {
    const result = redactSensitiveFields({ user: { profile: { apiKey: 'sk_live_abc123' } } }) as any;
    expect(result.user.profile.apiKey).toBe('[REDACTED]');
  });

  it('redacts sensitive fields inside arrays', () => {
    const result = redactSensitiveFields({ users: [{ token: 'abc' }, { token: 'def' }] }) as any;
    expect(result.users[0].token).toBe('[REDACTED]');
    expect(result.users[1].token).toBe('[REDACTED]');
  });

  it('is case-insensitive on key names', () => {
    const result = redactSensitiveFields({ Password: 'x', SECRET: 'y' }) as Record<string, unknown>;
    expect(result.Password).toBe('[REDACTED]');
    expect(result.SECRET).toBe('[REDACTED]');
  });

  it('leaves non-sensitive fields untouched', () => {
    const result = redactSensitiveFields({ vin: 'WBA123', mileage: 45000 }) as Record<string, unknown>;
    expect(result.vin).toBe('WBA123');
    expect(result.mileage).toBe(45000);
  });

  it('handles primitives and null/undefined without throwing', () => {
    expect(redactSensitiveFields('plain string')).toBe('plain string');
    expect(redactSensitiveFields(42)).toBe(42);
    expect(redactSensitiveFields(null)).toBeNull();
    expect(redactSensitiveFields(undefined)).toBeUndefined();
  });
});
