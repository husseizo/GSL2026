import { Injectable } from '@nestjs/common';
import { AiModelKind, AiModelStatus, ModelApprovalState } from '@prisma/client';
import { DgxClientService } from '../ai-gateway/dgx-client.service';
import { PrismaService } from '../prisma/prisma.service';
import { inferModelFamily, inferModelKind, inferQuantization } from './model-classification';

// The Model Deployment Manager concept from the spec: syncFromDgx() reflects
// whatever is *actually* pulled in the real Ollama instance into the
// registry, rather than the registry being hand-maintained and drifting
// from reality. The GPU Health Monitor is just a pass-through to the DGX
// service's own honest health check — no fabricated GPU metrics here or
// there. See docs/architecture/model-registry.md.
@Injectable()
export class ModelRegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dgxClient: DgxClientService,
  ) {}

  list(filter: { kind?: AiModelKind; status?: AiModelStatus } = {}) {
    return this.prisma.aiModel.findMany({ where: filter, orderBy: [{ kind: 'asc' }, { name: 'asc' }] });
  }

  findByName(name: string) {
    return this.prisma.aiModel.findUnique({ where: { name } });
  }

  async setDefault(id: string) {
    const model = await this.prisma.aiModel.findUniqueOrThrow({ where: { id } });
    return this.prisma.$transaction(async (tx) => {
      await tx.aiModel.updateMany({ where: { kind: model.kind, isDefault: true }, data: { isDefault: false } });
      return tx.aiModel.update({ where: { id }, data: { isDefault: true } });
    });
  }

  setStatus(id: string, status: 'ACTIVE' | 'TESTING' | 'DEPRECATED') {
    return this.prisma.aiModel.update({ where: { id }, data: { status } });
  }

  // Real network call to the DGX service's /v1/models, which itself is a
  // real call to Ollama's /api/tags — every model returned here genuinely
  // exists and is loadable, never a hand-typed placeholder list.
  async syncFromDgx(): Promise<{ registered: number; updated: number }> {
    const dgxModels = await this.dgxClient.models();
    let registered = 0;
    let updated = 0;

    for (const dgxModel of dgxModels) {
      const kind = inferModelKind(dgxModel.name);
      const family = inferModelFamily(dgxModel.name);
      const quantization = inferQuantization(dgxModel.name);

      const existing = await this.prisma.aiModel.findUnique({ where: { name: dgxModel.name } });
      if (existing) {
        await this.prisma.aiModel.update({
          where: { id: existing.id },
          data: { sizeBytes: BigInt(dgxModel.sizeBytes), family, quantization },
        });
        updated += 1;
        continue;
      }

      const hasDefaultForKind = await this.prisma.aiModel.findFirst({ where: { kind, isDefault: true } });

      await this.prisma.aiModel.create({
        data: {
          name: dgxModel.name,
          kind,
          family,
          quantization,
          sizeBytes: BigInt(dgxModel.sizeBytes),
          isDefault: !hasDefaultForKind,
        },
      });
      registered += 1;
    }

    return { registered, updated };
  }

  async gpuHealth() {
    return this.dgxClient.health();
  }

  // DGX Prototype 1.6 (AI Evaluation Framework) additions — real approval
  // workflow / rollback-target / hardware-metadata state, layered onto the
  // existing table via additive nullable columns (see prisma/schema.prisma).
  // "Every model must pass through the Evaluation Framework before
  // production" is enforced by convention here (nothing in this codebase
  // currently gates deployment on approvalState — that gating is the
  // Quality Gates' HUMAN_APPROVAL/REGRESSION checks, see
  // src/ai-benchmark/pipeline/quality-gates.ts), not by this setter alone.
  setApprovalState(id: string, approvalState: ModelApprovalState) {
    return this.prisma.aiModel.update({ where: { id }, data: { approvalState } });
  }

  async setRollbackTarget(id: string, rollbackTargetId: string | null) {
    if (rollbackTargetId === id) {
      throw new Error('A model cannot be its own rollback target');
    }
    return this.prisma.aiModel.update({ where: { id }, data: { rollbackTargetId } });
  }

  updateHardwareMetadata(id: string, metadata: { contextLength?: number; license?: string; hardwareRequirements?: Record<string, unknown>; embeddingDimensions?: number; embeddingCompatibleWith?: string[] }) {
    return this.prisma.aiModel.update({
      where: { id },
      data: {
        contextLength: metadata.contextLength,
        license: metadata.license,
        hardwareRequirements: metadata.hardwareRequirements as object | undefined,
        embeddingDimensions: metadata.embeddingDimensions,
        embeddingCompatibleWith: metadata.embeddingCompatibleWith as unknown as object | undefined,
      },
    });
  }

  // Real relation lookup, not denormalized state — every BenchmarkRun that
  // ever used this model as its generator or embedding model.
  evaluationHistory(id: string) {
    return this.prisma.benchmarkRun.findMany({
      where: { OR: [{ modelId: id }, { embeddingModelId: id }] },
      orderBy: { startedAt: 'desc' },
      include: { benchmark: true },
    });
  }
}
