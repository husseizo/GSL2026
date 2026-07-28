import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { createHash } from 'crypto';
import { Observable, of } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';

const IDEMPOTENCY_HEADER = 'idempotency-key';
const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

// Global interceptor (registered in main.ts) — a no-op for any request that
// doesn't send an Idempotency-Key header, so no existing Phase 1-4 caller
// is affected. When a key IS presented on a POST/PUT/PATCH, a repeat
// request with the same key returns the first response verbatim instead of
// re-executing a (possibly non-idempotent) side effect a second time — the
// standard pattern for safely retrying "did that purchase order actually
// get created?" after a dropped connection. See docs/architecture/api-platform.md.
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const key = request.headers[IDEMPOTENCY_HEADER];

    if (!key || !['POST', 'PUT', 'PATCH'].includes(request.method)) {
      return next.handle();
    }

    const requestHash = createHash('sha256').update(JSON.stringify(request.body ?? {})).digest('hex');
    const existing = await this.prisma.idempotencyKey.findUnique({ where: { key } });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        response.status(409);
        return of({ error: { code: 'IdempotencyKeyConflict', message: 'This Idempotency-Key was already used with a different request body' } });
      }
      if (existing.completedAt) {
        response.status(existing.responseStatus ?? 200);
        return of(existing.responseBody);
      }
      // A request with this key is already in flight (completedAt is still
      // null) — treat as a conflict rather than racing to write two rows.
      response.status(409);
      return of({ error: { code: 'IdempotentRequestInProgress', message: 'A request with this Idempotency-Key is already being processed' } });
    }

    await this.prisma.idempotencyKey.create({ data: { key, requestHash } });

    // mergeMap (not tap): tap's callback return value is ignored, so an
    // async side effect inside it is fire-and-forget — the observable would
    // complete and the response would be sent to the client *before* the
    // DB write actually finished, leaving a window where a fast-following
    // duplicate request sees completedAt still null and is wrongly treated
    // as "already in progress." mergeMap awaits the returned promise before
    // emitting downstream, so the write is guaranteed to have committed by
    // the time this request's response goes out. Caught by a real
    // integration test race, not by inspection.
    return next.handle().pipe(
      mergeMap(async (result) => {
        await this.prisma.idempotencyKey.update({
          where: { key },
          data: { responseStatus: response.statusCode, responseBody: result as object, completedAt: new Date() },
        });
        return result;
      }),
    );
  }
}

export function idempotencyWindowExpired(createdAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - createdAt.getTime() > IDEMPOTENCY_WINDOW_MS;
}
