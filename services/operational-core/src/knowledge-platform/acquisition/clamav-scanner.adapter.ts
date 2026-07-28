// DGX Prototype 1.7.1 — real ClamAV integration, activates ONLY if a real
// clamscan/clamdscan binary is actually found on PATH at runtime. Uses the
// real `clamscan` npm package (a wrapper over the real system binary, not a
// reimplementation of AV logic). Never claims availability it hasn't
// actually verified — isAvailable() calls the library's own real init(),
// which itself probes for the binary.
import { Readable } from 'stream';
import { Injectable, Logger } from '@nestjs/common';
import { MalwareScannerAdapter, MalwareScanResult } from './malware-scanner.interface';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const NodeClam = require('clamscan');

@Injectable()
export class ClamAvScannerAdapter implements MalwareScannerAdapter {
  readonly name = 'CLAMAV';
  private readonly logger = new Logger(ClamAvScannerAdapter.name);
  private instance: import('clamscan') | null = null;
  private probed = false;

  async isAvailable(): Promise<boolean> {
    if (this.probed) return this.instance !== null;
    this.probed = true;
    try {
      this.instance = await new NodeClam().init({ clamdscan: { active: true }, clamscan: { active: true } });
      return true;
    } catch (err) {
      this.logger.warn(`Real ClamAV binary not available in this environment — falling back to EICAR-only scanning: ${(err as Error).message}`);
      this.instance = null;
      return false;
    }
  }

  async scan(bytes: Buffer): Promise<MalwareScanResult> {
    if (!(await this.isAvailable()) || !this.instance) {
      throw new Error('ClamAvScannerAdapter.scan() called while unavailable — callers must check isAvailable() first.');
    }
    const stream = Readable.from(bytes);
    return new Promise((resolve, reject) => {
      this.instance!.scanStream(stream, (err: Error | null, isInfected: boolean) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({ clean: !isInfected, scannerUsed: this.name });
      });
    });
  }
}
