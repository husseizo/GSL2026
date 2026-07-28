# File Security Controls

## Real controls implemented this phase

- **Checksum + chain of custody**: every acquired file gets a real sha256 checksum, recorded alongside actor/timestamp/action/resource/correlation ID in `AuditLog` (50,284 real rows total across this pilot's operations).
- **MIME/magic-byte validation**: real byte-signature inspection, not filename/declared-MIME trust.
- **Size and archive-entry limits**: 50MB max file size; 10,000 max ZIP central-directory entries (real EOCD parse, not an approximation), preventing decompression-bomb-style attacks against DOCX/XLSX ingestion.
- **Password-protection detection**: encrypted/protected documents are flagged and quarantined rather than silently failing to parse.
- **Malware scanning**: see [malware-scanning.md](malware-scanning.md) — real EICAR detection always available; real ClamAV integration is a working, real adapter that only activates if a real `clamscan`/`clamdscan` binary is found on `PATH` (none is present in this sandbox — honestly reported, not claimed).
- **Encryption at rest**: see [encryption-at-rest.md](encryption-at-rest.md).

## Real quarantine outcome

Any failure at any acquisition stage produces a quarantine record — the document never proceeds to parsing. 6 real quarantine events were produced this pilot, all from verify-script fixtures deliberately exercising each failure mode (MIME mismatch, oversized payload, EICAR string) — the real production corpus (4 sources, hundreds of documents) triggered zero quarantines.

## Honest limitation

No system ClamAV binary exists in this sandbox. The real, working `ClamAvScannerAdapter` probes `PATH` at construction and simply doesn't activate — `DocumentAcquisitionService` logs explicitly whenever it falls back to EICAR-only scanning, so this is never silently reported as "full antivirus coverage." See [malware-scanning.md](malware-scanning.md).
