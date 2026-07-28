// DGX Prototype 1.6 — Benchmark Registry (spec §1) + Gold Dataset (spec §3).
//
// Benchmark versioning is append-only, the same pattern PromptRegistryService
// already established for PromptVersion: a correction never edits a
// published Benchmark row, it creates version = latest+1. The immutable
// Gold Dataset requirement is enforced here in application code (not just
// documented): once a benchmark is APPROVED and marked isGold, addCases()
// and any case-mutating method refuses further writes — the only way to
// change a gold benchmark's case set is to publish a new version.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BenchmarkApprovalStatus, BenchmarkCaseStatus, BenchmarkCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BenchmarkCaseDraft } from '../categories/category-taxonomy';
import { computeBenchmarkChecksum } from './checksum';

export interface CreateBenchmarkInput {
  key: string;
  category: BenchmarkCategory;
  subCategory?: string;
  name: string;
  description: string;
  ownerId?: string;
  provenance: Record<string, unknown>;
  createdById?: string;
}

@Injectable()
export class BenchmarkRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  async createBenchmark(input: CreateBenchmarkInput) {
    const existing = await this.prisma.benchmark.findFirst({ where: { key: input.key }, orderBy: { version: 'desc' } });
    if (existing) {
      throw new BadRequestException(`Benchmark key "${input.key}" already exists at version ${existing.version} — use createNewVersion() to publish a correction, never a duplicate key/version 1`);
    }
    return this.prisma.benchmark.create({
      data: {
        key: input.key,
        version: 1,
        category: input.category,
        subCategory: input.subCategory,
        name: input.name,
        description: input.description,
        ownerId: input.ownerId,
        provenance: input.provenance as object,
        createdById: input.createdById,
      },
    });
  }

  // Append-only correction — never edits a previously published Benchmark
  // row, even an unapproved DRAFT one, so every past BenchmarkRun stays
  // attributable to the exact case set it actually ran against.
  async createNewVersion(key: string, updates: Partial<Omit<CreateBenchmarkInput, 'key'>>) {
    const latest = await this.prisma.benchmark.findFirst({ where: { key }, orderBy: { version: 'desc' } });
    if (!latest) throw new NotFoundException(`No benchmark found with key "${key}"`);

    return this.prisma.benchmark.create({
      data: {
        key,
        version: latest.version + 1,
        category: updates.category ?? latest.category,
        subCategory: updates.subCategory ?? latest.subCategory,
        name: updates.name ?? latest.name,
        description: updates.description ?? latest.description,
        ownerId: updates.ownerId ?? latest.ownerId,
        provenance: (updates.provenance ?? latest.provenance) as object,
        createdById: updates.createdById,
      },
    });
  }

  async getLatestVersion(key: string) {
    const benchmark = await this.prisma.benchmark.findFirst({ where: { key }, orderBy: { version: 'desc' } });
    if (!benchmark) throw new NotFoundException(`No benchmark found with key "${key}"`);
    return benchmark;
  }

  listBenchmarks(filter: { category?: BenchmarkCategory; approvalStatus?: BenchmarkApprovalStatus } = {}) {
    return this.prisma.benchmark.findMany({ where: filter, orderBy: [{ category: 'asc' }, { key: 'asc' }, { version: 'desc' }] });
  }

  // Real immutability enforcement — refuses to add cases to a benchmark
  // that is already APPROVED and marked isGold. This is the actual
  // mechanism (not just a documented convention) behind "nothing may
  // modify this dataset automatically" (spec §3).
  async addCases(benchmarkId: string, drafts: BenchmarkCaseDraft[]) {
    const benchmark = await this.prisma.benchmark.findUniqueOrThrow({ where: { id: benchmarkId } });
    if (benchmark.isGold && benchmark.approvalStatus === 'APPROVED') {
      throw new BadRequestException(`Benchmark "${benchmark.key}" v${benchmark.version} is an approved Gold Dataset — its case set is immutable. Publish a new version via createNewVersion() instead.`);
    }

    if (drafts.length === 0) return { created: 0 };
    await this.prisma.benchmarkCase.createMany({
      data: drafts.map((d) => ({
        benchmarkId,
        externalCaseId: d.externalCaseId,
        input: d.input as object,
        expectedOutput: d.expectedOutput as object,
        difficulty: d.difficulty,
        language: d.language,
        status: d.status,
        provenance: d.provenance as object | undefined,
      })),
      skipDuplicates: true,
    });
    return { created: drafts.length };
  }

  listCases(benchmarkId: string, filter: { status?: BenchmarkCaseStatus } = {}) {
    return this.prisma.benchmarkCase.findMany({ where: { benchmarkId, ...filter }, orderBy: { externalCaseId: 'asc' } });
  }

  async approve(benchmarkId: string, reviewerId?: string) {
    return this.prisma.benchmark.update({
      where: { id: benchmarkId },
      data: { approvalStatus: 'APPROVED', approvedAt: new Date(), reviewerId },
    });
  }

  async reject(benchmarkId: string, reviewerId?: string) {
    return this.prisma.benchmark.update({ where: { id: benchmarkId }, data: { approvalStatus: 'REJECTED', reviewerId } });
  }

  // Gold Dataset freeze (spec §3) — requires the benchmark to already be
  // APPROVED (a benchmark cannot become an immutable gold standard before
  // a human has reviewed it), computes a real checksum over its current
  // case set, and flips isGold. After this call, addCases() on this exact
  // row will always refuse.
  async freezeAsGold(benchmarkId: string) {
    const benchmark = await this.prisma.benchmark.findUniqueOrThrow({ where: { id: benchmarkId } });
    if (benchmark.approvalStatus !== 'APPROVED') {
      throw new BadRequestException(`Benchmark "${benchmark.key}" v${benchmark.version} must be APPROVED before it can be frozen as a Gold Dataset (current status: ${benchmark.approvalStatus})`);
    }
    const cases = await this.prisma.benchmarkCase.findMany({ where: { benchmarkId }, select: { externalCaseId: true } });
    if (cases.length === 0) {
      throw new BadRequestException(`Benchmark "${benchmark.key}" v${benchmark.version} has no cases — cannot freeze an empty dataset as gold`);
    }
    const checksum = computeBenchmarkChecksum(cases.map((c) => c.externalCaseId));
    return this.prisma.benchmark.update({ where: { id: benchmarkId }, data: { isGold: true, checksum } });
  }

  // Real integrity check — recomputes the checksum from the CURRENT case
  // set and compares against what was frozen. A mismatch means the
  // supposedly-immutable dataset drifted (e.g. a direct DB edit bypassing
  // addCases()'s own guard) — this is what actually catches that, not just
  // the addCases() guard alone.
  async verifyChecksum(benchmarkId: string): Promise<{ matches: boolean; storedChecksum: string | null; recomputedChecksum: string }> {
    const benchmark = await this.prisma.benchmark.findUniqueOrThrow({ where: { id: benchmarkId } });
    const cases = await this.prisma.benchmarkCase.findMany({ where: { benchmarkId }, select: { externalCaseId: true } });
    const recomputedChecksum = computeBenchmarkChecksum(cases.map((c) => c.externalCaseId));
    return { matches: benchmark.checksum === recomputedChecksum, storedChecksum: benchmark.checksum, recomputedChecksum };
  }
}
