// DGX Prototype 1.6 — Prompt Laboratory / A-B Experiments (spec §6-7).
//
// Reuses PromptRegistryService's existing append-only publishVersion()
// directly — no parallel prompt-versioning mechanism. Since
// publishVersion() always creates a brand-new version (it has no
// "reactivate an old version by id" method — a deliberate append-only
// design, see prompt-registry.service.ts), running an arm means: capture
// the real currently-active version's content first, publish each arm's
// content as the new active version in turn, run the benchmark pipeline
// against it, and — critically — republish the ORIGINAL content as the
// active version again once every arm has run, so the experiment never
// leaves production pointed at an experimental arm. This is the same
// publish-run-revert pattern DGX Prototype 1.5's
// scripts/_tmp_decoding_compare.ts already used manually; this service
// makes it a real, repeatable, tracked mechanism instead of a one-off script.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PromptRegistryService } from '../../prompt-registry/prompt-registry.service';
import { BenchmarkPipelineService } from '../pipeline/benchmark-pipeline.service';
import { selectWinner, ExperimentArmSnapshot } from './metric-selection';
import { CategoryMetrics } from '../categories/category-taxonomy';

export interface ExperimentArmDefinition {
  label: string;
  systemPrompt: string;
  userPromptTemplate: string;
  temperature?: number;
}

export interface CreateExperimentInput {
  name: string;
  hypothesis?: string;
  selectionMetric: string; // e.g. "avgGroundedness"
  benchmarkId?: string;
  createdById?: string;
}

@Injectable()
export class PromptExperimentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promptRegistry: PromptRegistryService,
    private readonly pipeline: BenchmarkPipelineService,
  ) {}

  async createExperiment(input: CreateExperimentInput) {
    return this.prisma.promptExperiment.create({
      data: { name: input.name, hypothesis: input.hypothesis, selectionMetric: input.selectionMetric, benchmarkId: input.benchmarkId, createdById: input.createdById, status: 'DRAFT' },
    });
  }

  // Runs every arm against the same benchmark, in sequence, restoring the
  // original active prompt version when done — real DGX/Ollama calls, not
  // simulated. Requires a GENERATION-category benchmark (only that
  // category's pipeline run produces prompt-sensitive metrics).
  async runExperiment(experimentId: string, promptTemplateName: string, arms: ExperimentArmDefinition[], category: 'GENERATION' | 'SWAHILI' | 'ENGLISH' | 'MIXED_LANGUAGE' = 'GENERATION') {
    const experiment = await this.prisma.promptExperiment.findUniqueOrThrow({ where: { id: experimentId } });
    if (!experiment.benchmarkId) throw new BadRequestException(`PromptExperiment "${experiment.name}" has no benchmarkId set — cannot run it against a real dataset`);

    const originalActive = await this.promptRegistry.getActiveVersion(promptTemplateName);
    const armSnapshots: ExperimentArmSnapshot[] = [];

    await this.prisma.promptExperiment.update({ where: { id: experimentId }, data: { status: 'RUNNING' } });

    try {
      for (const armDef of arms) {
        const publishedVersion = await this.promptRegistry.publishVersion(promptTemplateName, {
          systemPrompt: armDef.systemPrompt,
          userPromptTemplate: armDef.userPromptTemplate,
          temperature: armDef.temperature,
        });

        const arm = await this.prisma.promptExperimentArm.create({
          data: { experimentId, label: armDef.label, promptVersionId: publishedVersion.id },
        });

        const categoryMetrics: CategoryMetrics = category === 'GENERATION' ? await this.pipeline.runGenerationCategory({ benchmarkId: experiment.benchmarkId, promptVersionId: publishedVersion.id }) : await this.pipeline.runLanguageCategory({ benchmarkId: experiment.benchmarkId, promptVersionId: publishedVersion.id }, category);

        await this.prisma.promptExperimentArm.update({ where: { id: arm.id }, data: { metrics: categoryMetrics.metrics as unknown as object } });
        armSnapshots.push({ armId: arm.id, label: armDef.label, metrics: categoryMetrics.metrics as unknown as Record<string, unknown> });
      }
    } finally {
      // Always restore the real original active version, even if an arm's
      // run threw — an experiment must never leave production pointed at
      // an experimental prompt.
      await this.promptRegistry.publishVersion(promptTemplateName, {
        systemPrompt: originalActive.systemPrompt,
        userPromptTemplate: originalActive.userPromptTemplate,
        temperature: originalActive.temperature,
        maxTokens: originalActive.maxTokens ?? undefined,
        modelId: originalActive.modelId ?? undefined,
      });
    }

    const selection = selectWinner(armSnapshots, experiment.selectionMetric);
    await this.prisma.promptExperiment.update({
      where: { id: experimentId },
      data: { status: 'COMPLETED', winnerArmId: selection.winnerArmId },
    });

    return { experiment, armSnapshots, selection };
  }

  // "Never a manual override without a documented reason" — decideWinner()
  // is the only way to set a DIFFERENT winner than metric-selection.ts
  // chose, and it requires a non-empty reason, logged permanently.
  async decideWinner(experimentId: string, winnerArmId: string, decidedById: string, decisionNotes: string) {
    if (!decisionNotes || decisionNotes.trim().length === 0) {
      throw new BadRequestException('A manual winner override requires a non-empty decisionNotes explaining why the metric-selected winner was overridden');
    }
    const arm = await this.prisma.promptExperimentArm.findUnique({ where: { id: winnerArmId } });
    if (!arm || arm.experimentId !== experimentId) throw new NotFoundException(`Arm ${winnerArmId} does not belong to experiment ${experimentId}`);

    return this.prisma.promptExperiment.update({
      where: { id: experimentId },
      data: { winnerArmId, decidedById, decidedAt: new Date(), decisionNotes, status: 'DECIDED' },
    });
  }

  getExperiment(experimentId: string) {
    return this.prisma.promptExperiment.findUniqueOrThrow({ where: { id: experimentId }, include: { arms: true } });
  }

  listExperiments() {
    return this.prisma.promptExperiment.findMany({ orderBy: { createdAt: 'desc' } });
  }
}
