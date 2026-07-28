import { createServer } from 'https';
import * as https from 'https';
import { generateSelfSignedCertificate } from './self-signed-cert';

describe('generateSelfSignedCertificate (real X.509 material)', () => {
  it('produces PEM-formatted key and certificate material', async () => {
    const cert = await generateSelfSignedCertificate('localhost', 30);
    expect(cert.privateKeyPem).toContain('-----BEGIN PRIVATE KEY-----');
    expect(cert.certificatePem).toContain('-----BEGIN CERTIFICATE-----');
    expect(cert.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('the generated cert/key pair actually works: a real HTTPS server starts and accepts a real TLS connection with it', async () => {
    const cert = await generateSelfSignedCertificate('localhost', 30);

    const server = createServer({ key: cert.privateKeyPem, cert: cert.certificatePem }, (_req, res) => {
      res.end('ok');
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port;

    // Self-signed certs are, by construction, not chain-of-trust verifiable
    // — that's the one thing a real CA-issued cert buys over this.
    // `rejectUnauthorized: false` on this one real https.request (Node's
    // native TLS client, not the undici-based global fetch(), which doesn't
    // honor per-call/NODE_TLS_REJECT_UNAUTHORIZED overrides the same way)
    // is the standard way to prove the TLS handshake and encrypted
    // transport genuinely work with this exact key/cert pair.
    const body = await new Promise<string>((resolve, reject) => {
      const req = https.request({ host: '127.0.0.1', port, path: '/', method: 'GET', rejectUnauthorized: false }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.end();
    });

    expect(body).toBe('ok');

    await new Promise((resolve) => server.close(resolve));
  }, 10_000);
});
