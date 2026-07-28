import { promises as fs } from 'fs';
import * as path from 'path';
import { RawChangeBatch, RawChangeRecord, SourceAdapter, SyncCursor } from './source-adapter.interface';

type FileDropEntityType = SourceAdapter['entityType'];

interface FileDropLine {
  sourceRecordId: string;
  operation?: 'UPSERT' | 'DELETE';
  payload: unknown;
  sourceTimestamp: string;
  recordVersion?: string;
}

// Simulates what a nightly extract or CDC export from the real legacy sales
// DB would look like: a directory of newline-delimited JSON files, processed
// in filename order. Cursor is "<filename>:<nextLineIndex>" so a crash mid-file
// resumes exactly where it left off — see docs/architecture/02-integration-contracts.md §5.
export class FileDropAdapter<TRaw = unknown> implements SourceAdapter<TRaw> {
  constructor(
    public readonly sourceSystem: string,
    public readonly entityType: FileDropEntityType,
    private readonly directory: string,
    private readonly batchSize = 50,
  ) {}

  async *fetchChanges(cursor: SyncCursor): AsyncIterable<RawChangeBatch<TRaw>> {
    const files = (await fs.readdir(this.directory))
      .filter((f) => f.endsWith('.ndjson'))
      .sort();

    let resumeFile: string | null = null;
    let resumeLine = 0;
    if (cursor) {
      const separatorIndex = cursor.lastIndexOf(':');
      resumeFile = cursor.slice(0, separatorIndex);
      resumeLine = parseInt(cursor.slice(separatorIndex + 1), 10);
    }

    let reachedResumePoint = resumeFile === null;

    for (const file of files) {
      if (!reachedResumePoint) {
        if (file === resumeFile) {
          reachedResumePoint = true;
        } else {
          continue;
        }
      }

      const startLine = file === resumeFile ? resumeLine : 0;
      const content = await fs.readFile(path.join(this.directory, file), 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim().length > 0);

      let batch: RawChangeRecord<TRaw>[] = [];
      for (let i = startLine; i < lines.length; i += 1) {
        const parsed = JSON.parse(lines[i]) as FileDropLine;
        batch.push({
          sourceRecordId: parsed.sourceRecordId,
          operation: parsed.operation ?? 'UPSERT',
          payload: parsed.payload as TRaw,
          sourceTimestamp: new Date(parsed.sourceTimestamp),
          recordVersion: parsed.recordVersion,
        });

        const isLastLineOfFile = i === lines.length - 1;
        if (batch.length >= this.batchSize || isLastLineOfFile) {
          yield { cursor: `${file}:${i + 1}`, records: batch };
          batch = [];
        }
      }
    }
  }
}
