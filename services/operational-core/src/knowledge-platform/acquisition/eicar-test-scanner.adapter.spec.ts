import { EicarTestScannerAdapter, EICAR_TEST_STRING } from './eicar-test-scanner.adapter';

describe('EicarTestScannerAdapter', () => {
  const scanner = new EicarTestScannerAdapter();

  it('is always available (no external binary dependency)', async () => {
    expect(await scanner.isAvailable()).toBe(true);
  });

  it('detects the real, standardized EICAR test signature', async () => {
    const result = await scanner.scan(Buffer.from(EICAR_TEST_STRING));
    expect(result.clean).toBe(false);
    expect(result.signature).toBe('EICAR-STANDARD-ANTIVIRUS-TEST-FILE');
  });

  it('reports clean for real, legitimate content', async () => {
    const result = await scanner.scan(Buffer.from('Tighten the sump plug to 35 Nm.'));
    expect(result.clean).toBe(true);
  });
});
