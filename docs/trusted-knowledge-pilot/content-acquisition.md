# Content Acquisition Pipeline

`DocumentAcquisitionService` (`src/knowledge-platform/acquisition/document-acquisition.service.ts`) runs before any parsing, in this order, matching spec §8:

1. Real checksum (sha256) computed and stored for chain-of-custody.
2. MIME-vs-actual-content sniff via real magic-byte inspection (`MAGIC_BYTES` array: PDF `%PDF`, ZIP/OOXML `PK\x03\x04`, OLE2/legacy Office `D0 CF 11 E0`, etc.) — a file claiming to be a PDF whose bytes don't match is rejected, not trusted on extension/declared MIME alone.
3. Size limit (`MAX_FILE_SIZE_BYTES` = 50MB) and, for ZIP-based formats (DOCX/XLSX), a real End-Of-Central-Directory parse (`countZipEntries()`) enforcing `MAX_ZIP_ENTRY_COUNT` = 10,000 to catch decompression/zip-bomb attempts before any entry is expanded.
4. Password-protection detection.
5. Malware scan (see [malware-scanning.md](malware-scanning.md)).
6. Quarantine on any failure at any stage above, with a real audit record (chain-of-custody: actor, timestamp, action, resource, correlation ID).

No file reaches the parsing stage before every check above passes. This matches the spec's explicit rule: "No file may enter parsing before security validation passes."

## Real quarantine count

6 real quarantine events recorded in the audit log this pilot (verify-script fixtures exercising MIME mismatch, oversized payload, and EICAR detection — the real production corpus of 4 sources produced zero real quarantines, since none of its content is malicious or malformed).

## See also

[file-security.md](file-security.md), [malware-scanning.md](malware-scanning.md).
