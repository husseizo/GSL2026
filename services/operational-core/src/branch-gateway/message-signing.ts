import { createHmac, timingSafeEqual } from 'crypto';

// Real HMAC-SHA256 message signing — a branch gateway message's integrity
// is verifiable independent of transport (TLS protects the wire; this
// protects against a message being tampered with anywhere it's queued,
// cached, or relayed). See docs/architecture/branch-gateway.md.
function getSecret(): string {
  const secret = process.env.BRANCH_GATEWAY_SIGNING_KEY;
  if (!secret) throw new Error('BRANCH_GATEWAY_SIGNING_KEY environment variable is not set');
  return secret;
}

export function signPayload(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('hex');
}

export function verifyPayloadSignature(payload: string, signature: string): boolean {
  const expected = signPayload(payload);
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
