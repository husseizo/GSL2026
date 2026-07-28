import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { renderPromptTemplate } from './prompt-render';

export interface PublishVersionParams {
  systemPrompt: string;
  userPromptTemplate: string;
  temperature?: number;
  maxTokens?: number;
  modelId?: string;
  createdById?: string;
}

// Append-only prompt versioning, same shape as EstimateRevision /
// JobStatusHistory: publishing a "correction" never edits a previously
// published PromptVersion — it creates a new one and flips isActive, so any
// AiInferenceLog row referencing an older promptVersionId still points at
// the exact prompt text that produced that historical response. See
// docs/architecture/prompt-registry.md.
@Injectable()
export class PromptRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  async createTemplate(name: string, purpose: string) {
    return this.prisma.promptTemplate.create({ data: { name, purpose } });
  }

  listTemplates() {
    return this.prisma.promptTemplate.findMany({ orderBy: { name: 'asc' } });
  }

  async listVersions(templateName: string) {
    const template = await this.getTemplateOrThrow(templateName);
    return this.prisma.promptVersion.findMany({ where: { templateId: template.id }, orderBy: { version: 'desc' } });
  }

  async getActiveVersion(templateName: string) {
    const template = await this.getTemplateOrThrow(templateName);
    const active = await this.prisma.promptVersion.findFirst({ where: { templateId: template.id, isActive: true } });
    if (!active) throw new NotFoundException(`Prompt template ${templateName} has no active version`);
    return active;
  }

  async publishVersion(templateName: string, params: PublishVersionParams) {
    const template = await this.getTemplateOrThrow(templateName);

    return this.prisma.$transaction(async (tx) => {
      await tx.promptVersion.updateMany({ where: { templateId: template.id, isActive: true }, data: { isActive: false } });

      const latest = await tx.promptVersion.findFirst({ where: { templateId: template.id }, orderBy: { version: 'desc' } });
      const nextVersion = (latest?.version ?? 0) + 1;

      return tx.promptVersion.create({
        data: {
          templateId: template.id,
          version: nextVersion,
          systemPrompt: params.systemPrompt,
          userPromptTemplate: params.userPromptTemplate,
          temperature: params.temperature ?? 0.2,
          maxTokens: params.maxTokens,
          modelId: params.modelId,
          createdById: params.createdById,
          isActive: true,
        },
      });
    });
  }

  // Renders the currently-active version against the given variables —
  // callers (RAG, assistants) get back exactly what to send to
  // AiGatewayService.generate(), plus the promptVersionId to attach to the
  // resulting AiInferenceLog for traceability.
  async render(templateName: string, variables: Record<string, string>) {
    const active = await this.getActiveVersion(templateName);
    const { rendered, missingVariables } = renderPromptTemplate(active.userPromptTemplate, variables);
    return {
      promptVersionId: active.id,
      systemPrompt: active.systemPrompt,
      userPrompt: rendered,
      missingVariables,
      temperature: active.temperature,
      maxTokens: active.maxTokens ?? undefined,
      modelId: active.modelId ?? undefined,
    };
  }

  private async getTemplateOrThrow(name: string) {
    const template = await this.prisma.promptTemplate.findUnique({ where: { name } });
    if (!template) throw new NotFoundException(`Prompt template ${name} not found`);
    return template;
  }
}
