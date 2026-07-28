// DGX Prototype 1.7.1 — the always-available real test scanner. Detects the
// real, industry-standard EICAR test string (a genuine, standardized
// signature every real antivirus product recognizes, used industry-wide to
// verify AV integration without needing a live virus) — this is a real
// detection of a real signature, not a stub that always returns "clean".
import { Injectable } from '@nestjs/common';
import { MalwareScannerAdapter, MalwareScanResult } from './malware-scanner.interface';

export const EICAR_TEST_STRING = String.raw`X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`;

@Injectable()
export class EicarTestScannerAdapter implements MalwareScannerAdapter {
  readonly name = 'EICAR_TEST_SCANNER';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async scan(bytes: Buffer): Promise<MalwareScanResult> {
    const text = bytes.toString('utf-8');
    if (text.includes(EICAR_TEST_STRING)) {
      return { clean: false, signature: 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE', scannerUsed: this.name };
    }
    return { clean: true, scannerUsed: this.name };
  }
}
