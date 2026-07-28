import { generateMfaSecret, generateMfaToken, getMfaKeyUri, verifyMfaToken } from './mfa';

describe('mfa (real TOTP via otplib, RFC 6238)', () => {
  it('generates a real secret and a token that verifies against it', async () => {
    const secret = await generateMfaSecret();
    const token = await generateMfaToken(secret);
    expect(token).toMatch(/^\d{6}$/);
    expect(await verifyMfaToken(token, secret)).toBe(true);
  });

  it('rejects a token generated from a different secret', async () => {
    const secretA = await generateMfaSecret();
    const secretB = await generateMfaSecret();
    const tokenA = await generateMfaToken(secretA);
    expect(await verifyMfaToken(tokenA, secretB)).toBe(false);
  });

  it('rejects a garbage token', async () => {
    const secret = await generateMfaSecret();
    expect(await verifyMfaToken('000000', secret)).toBe(false);
  });

  it('produces a standard otpauth:// key URI for QR-code enrollment', async () => {
    const secret = await generateMfaSecret();
    const uri = getMfaKeyUri('user@example.com', secret);
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain('AIOS');
  });
});
