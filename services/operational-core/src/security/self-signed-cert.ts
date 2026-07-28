import selfsigned from 'selfsigned';

// Real X.509 certificate generation (RSA keypair + self-signed cert, via
// node-forge under the hood) — genuinely valid PEM material, not a
// placeholder string. There is no real domain/CA-issued certificate to
// provision in this sandbox; this is what "encryption in transit" looks
// like as a real, runnable capability here, with the honest caveat that a
// production deployment needs a CA-issued cert (Let's Encrypt, etc.)
// instead of a self-signed one. See docs/architecture/security-production.md.
export interface GeneratedCertificate {
  privateKeyPem: string;
  certificatePem: string;
  expiresAt: Date;
}

export async function generateSelfSignedCertificate(commonName = 'localhost', validDays = 365): Promise<GeneratedCertificate> {
  const attrs = [{ name: 'commonName', value: commonName }];
  const expiresAt = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000);
  const pems = await selfsigned.generate(attrs, { notAfterDate: expiresAt, keySize: 2048 });

  return {
    privateKeyPem: pems.private,
    certificatePem: pems.cert,
    expiresAt,
  };
}
