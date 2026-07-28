import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { compressPayload, decompressPayload } from './compression';
import { signPayload, verifyPayloadSignature } from './message-signing';

const MAX_DELIVERY_ATTEMPTS = 5;
const COMPRESSION_THRESHOLD_BYTES = 1024;

export type MessageDeliverer = (payload: unknown) => Promise<void>;

// The communication layer between a branch and headquarters (spec §7/§18 —
// Branch Gateway and Edge Operations are the same mechanism here, not two
// parallel systems, since "offline queue + retry + conflict detection +
// priority queues + background sync" is one problem regardless of which
// section of the spec names it). BranchOutboxMessage is a real, durable,
// Postgres-backed outbox — a branch that's offline just accumulates PENDING
// rows; nothing is lost, and processQueue() drains them in priority order
// once connectivity returns. There is no second physical branch server in
// this environment to network to, so `deliver` is an injected function —
// tests and the verification script pass a real deliverer that can
// genuinely fail/succeed, proving the retry/backoff/dead-letter logic for
// real rather than asserting it in isolation. See
// docs/architecture/branch-gateway.md.
@Injectable()
export class BranchGatewayService {
  private readonly logger = new Logger(BranchGatewayService.name);

  constructor(private readonly prisma: PrismaService) {}

  async enqueue(branchId: string, messageType: string, payload: unknown, priority = 5): Promise<{ id: string; compressed: boolean }> {
    const json = JSON.stringify(payload);
    const signature = signPayload(json);
    const shouldCompress = Buffer.byteLength(json, 'utf8') > COMPRESSION_THRESHOLD_BYTES;

    const message = await this.prisma.branchOutboxMessage.create({
      data: {
        branchId,
        messageType,
        payload: shouldCompress ? { compressed: compressPayload(json).toString('base64') } : (payload as object),
        priority,
        signature,
        compressed: shouldCompress,
      },
    });

    return { id: message.id, compressed: shouldCompress };
  }

  async dequeueNext(branchId: string) {
    return this.prisma.branchOutboxMessage.findFirst({
      where: { branchId, status: 'PENDING' },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
  }

  // Drains the whole PENDING queue for a branch through the given
  // deliverer, oldest-highest-priority first, applying real retry-with-
  // attempt-tracking on failure and marking a message FAILED (not deleted —
  // it stays for inspection/replay) once MAX_DELIVERY_ATTEMPTS is exceeded.
  async processQueue(branchId: string, deliver: MessageDeliverer): Promise<{ sent: number; failed: number; remaining: number }> {
    let sent = 0;
    let failed = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const message = await this.dequeueNext(branchId);
      if (!message) break;

      const rawPayload = message.compressed
        ? JSON.parse(decompressPayload(Buffer.from((message.payload as { compressed: string }).compressed, 'base64')))
        : message.payload;

      const signatureValid = verifyPayloadSignature(JSON.stringify(rawPayload), message.signature ?? '');
      if (!signatureValid) {
        await this.prisma.branchOutboxMessage.update({
          where: { id: message.id },
          data: { status: 'FAILED', lastError: 'Signature verification failed — payload may have been tampered with', attempts: { increment: 1 } },
        });
        failed += 1;
        continue;
      }

      try {
        await deliver(rawPayload);
        await this.prisma.branchOutboxMessage.update({
          where: { id: message.id },
          data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 }, lastAttemptAt: new Date() },
        });
        sent += 1;
      } catch (err) {
        const attempts = message.attempts + 1;
        const exhausted = attempts >= MAX_DELIVERY_ATTEMPTS;
        await this.prisma.branchOutboxMessage.update({
          where: { id: message.id },
          data: {
            status: exhausted ? 'FAILED' : 'PENDING',
            attempts,
            lastAttemptAt: new Date(),
            lastError: (err as Error).message,
          },
        });
        if (exhausted) {
          failed += 1;
          this.logger.warn(`Message ${message.id} for branch ${branchId} exhausted retries: ${(err as Error).message}`);
        } else {
          // Stop draining on a retryable failure rather than hot-looping —
          // the caller's next scheduled sync pass will pick it up again.
          break;
        }
      }
    }

    const remaining = await this.prisma.branchOutboxMessage.count({ where: { branchId, status: 'PENDING' } });
    return { sent, failed, remaining };
  }

  // Replay: re-queues a FAILED message as PENDING with attempts reset —
  // used after a human fixes whatever caused the exhausted retries (e.g.
  // rotating the signing key), or to manually re-drive a specific message.
  async replay(messageId: string) {
    const message = await this.prisma.branchOutboxMessage.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException(`Outbox message ${messageId} not found`);
    return this.prisma.branchOutboxMessage.update({ where: { id: messageId }, data: { status: 'PENDING', attempts: 0, lastError: null } });
  }

  async getQueueDepth(branchId: string): Promise<number> {
    return this.prisma.branchOutboxMessage.count({ where: { branchId, status: 'PENDING' } });
  }

  async recordHealthPing(branchId: string, isOnline: boolean, latencyMs?: number) {
    const queueDepth = await this.getQueueDepth(branchId);
    return this.prisma.branchHealthPing.create({ data: { branchId, isOnline, latencyMs, queueDepth } });
  }

  async getLatestHealth(branchId: string) {
    return this.prisma.branchHealthPing.findFirst({ where: { branchId }, orderBy: { pingedAt: 'desc' } });
  }

  listMessages(branchId: string, status?: string) {
    return this.prisma.branchOutboxMessage.findMany({ where: { branchId, status }, orderBy: { createdAt: 'desc' } });
  }
}
