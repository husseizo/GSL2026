import { signPayload, verifyPayloadSignature } from './message-signing';

describe('message-signing', () => {
  const originalKey = process.env.BRANCH_GATEWAY_SIGNING_KEY;

  beforeAll(() => {
    process.env.BRANCH_GATEWAY_SIGNING_KEY = 'test-signing-key-not-for-production';
  });

  afterAll(() => {
    process.env.BRANCH_GATEWAY_SIGNING_KEY = originalKey;
  });

  it('produces a signature that verifies against the same payload', () => {
    const payload = JSON.stringify({ jobId: '123', amount: 500 });
    const signature = signPayload(payload);
    expect(verifyPayloadSignature(payload, signature)).toBe(true);
  });

  it('rejects a signature checked against a tampered payload', () => {
    const payload = JSON.stringify({ jobId: '123', amount: 500 });
    const signature = signPayload(payload);
    const tampered = JSON.stringify({ jobId: '123', amount: 5000 });
    expect(verifyPayloadSignature(tampered, signature)).toBe(false);
  });

  it('rejects a garbage signature of the wrong length without throwing', () => {
    expect(verifyPayloadSignature('some payload', 'not-a-real-signature')).toBe(false);
  });

  it('throws when the signing key is not configured', () => {
    delete process.env.BRANCH_GATEWAY_SIGNING_KEY;
    expect(() => signPayload('x')).toThrow('BRANCH_GATEWAY_SIGNING_KEY');
    process.env.BRANCH_GATEWAY_SIGNING_KEY = 'test-signing-key-not-for-production';
  });
});
