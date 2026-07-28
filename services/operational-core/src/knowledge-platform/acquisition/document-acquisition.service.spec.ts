import { DocumentAcquisitionService, MAX_FILE_SIZE_BYTES } from './document-acquisition.service';
import { EicarTestScannerAdapter, EICAR_TEST_STRING } from './eicar-test-scanner.adapter';
import { ClamAvScannerAdapter } from './clamav-scanner.adapter';

describe('DocumentAcquisitionService', () => {
  function build(): DocumentAcquisitionService {
    const audit = { log: jest.fn() } as never;
    const eicar = new EicarTestScannerAdapter();
    const clamAv = { isAvailable: jest.fn().mockResolvedValue(false), scan: jest.fn() } as unknown as ClamAvScannerAdapter;
    return new DocumentAcquisitionService(audit, eicar, clamAv);
  }

  it('accepts a real, legitimate PDF-shaped buffer', async () => {
    const service = build();
    const bytes = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('real content')]);
    const result = await service.acquire(bytes, 'pdf');
    expect(result.outcome).toBe('ACCEPTED');
    expect(result.scannerUsed).toBe('EICAR_TEST_SCANNER');
  });

  it('quarantines a real MIME mismatch (claimed pdf, real bytes are plain text)', async () => {
    const service = build();
    const result = await service.acquire(Buffer.from('not actually a pdf'), 'pdf');
    expect(result.outcome).toBe('QUARANTINED_MIME_MISMATCH');
  });

  it('quarantines a real EICAR-signature buffer regardless of claimed format', async () => {
    const service = build();
    const result = await service.acquire(Buffer.from(EICAR_TEST_STRING), 'text');
    expect(result.outcome).toBe('QUARANTINED_MALWARE');
  });

  it('quarantines a buffer exceeding the real size limit', async () => {
    const service = build();
    const oversized = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1);
    const result = await service.acquire(oversized, 'text');
    expect(result.outcome).toBe('QUARANTINED_SIZE_LIMIT');
  });

  it('quarantines a real password-protected (OLE2-wrapped) docx claim', async () => {
    const service = build();
    const ole2Bytes = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
    const result = await service.acquire(ole2Bytes, 'docx');
    expect(result.outcome).toBe('QUARANTINED_PASSWORD_PROTECTED');
  });

  it('produces a stable, real sha256 checksum regardless of scan outcome', async () => {
    const service = build();
    const bytes = Buffer.from('real, stable content');
    const result1 = await service.acquire(bytes, 'text');
    const result2 = await service.acquire(bytes, 'text');
    expect(result1.checksum).toBe(result2.checksum);
    expect(result1.checksum).toHaveLength(64);
  });
});
