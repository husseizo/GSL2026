import { Injectable, Logger } from '@nestjs/common';
import { AiInferenceKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DgxClientService, DgxUnavailableError } from './dgx-client.service';
import { sanitizePrompt } from './prompt-sanitizer';
import { RateLimiterService } from './rate-limiter.service';

export interface GenerateParams {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  promptVersionId?: string;
  actorId?: string;
  actorRole?: string;
  correlationId?: string;
  retrievedDocumentIds?: string[];
  confidence?: number;
  // Additive (DGX Prototype 1.5) — see DgxGenerateRequest.format.
  format?: 'json';
}

export interface EmbedParams {
  text: string;
  model?: string;
  actorId?: string;
  actorRole?: string;
}

export interface GenerateResult {
  available: boolean;
  text?: string;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
  logId: string;
  errorMessage?: string;
  injectionRiskFlags: string[];
}

export interface EmbedResult {
  available: boolean;
  embedding?: number[];
  model?: string;
  dims?: number;
  latencyMs?: number;
  logId: string;
  errorMessage?: string;
}

// The single choke point every AI-touching module calls through — RAG,
// technician/parts/lubricant/manager assistants, embeddings. Mirrors
// InventoryLedgerService.postMovement's role in Phase 2: nothing else is
// allowed to reach the DGX boundary directly. Every call is sanitized, rate
// limited, and logged to AiInferenceLog — success or failure — and a failure
// degrades to `{ available: false }` rather than throwing, so a caller (e.g.
// RagService) can always build a safe "AI unavailable" response instead of
// crashing the request. See docs/architecture/ai-governance.md and
// docs/architecture/security-dgx.md.
@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dgxClient: DgxClientService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const { sanitized, injectionRiskFlags } = sanitizePrompt(params.prompt);
    const rateLimitKey = params.actorId ?? 'anonymous';

    if (!this.rateLimiter.tryConsume(rateLimitKey)) {
      const log = await this.logInference({
        kind: AiInferenceKind.GENERATION,
        params,
        promptText: sanitized,
        success: false,
        errorMessage: 'rate_limited',
      });
      return { available: false, logId: log.id, errorMessage: 'Rate limit exceeded', injectionRiskFlags };
    }

    const model = params.model ?? (await this.resolveDefaultModel('GENERATION'));

    try {
      const response = await this.dgxClient.generate({
        prompt: sanitized,
        system: params.system,
        model,
        temperature: params.temperature,
        maxTokens: params.maxTokens,
        format: params.format,
      });

      const log = await this.logInference({
        kind: AiInferenceKind.GENERATION,
        params,
        promptText: sanitized,
        responseText: response.text,
        modelName: response.model,
        tokensIn: response.tokensIn,
        tokensOut: response.tokensOut,
        latencyMs: response.latencyMs,
        success: true,
      });

      return {
        available: true,
        text: response.text,
        model: response.model,
        tokensIn: response.tokensIn,
        tokensOut: response.tokensOut,
        latencyMs: response.latencyMs,
        logId: log.id,
        injectionRiskFlags,
      };
    } catch (err) {
      const errorMessage = err instanceof DgxUnavailableError ? err.message : (err as Error).message;
      this.logger.warn(`generate() failed: ${errorMessage}`);
      const log = await this.logInference({
        kind: AiInferenceKind.GENERATION,
        params,
        promptText: sanitized,
        modelName: model,
        success: false,
        errorMessage,
      });
      return { available: false, logId: log.id, errorMessage, injectionRiskFlags };
    }
  }

  async embed(params: EmbedParams): Promise<EmbedResult> {
    const { sanitized } = sanitizePrompt(params.text);
    const rateLimitKey = params.actorId ?? 'anonymous';

    if (!this.rateLimiter.tryConsume(rateLimitKey)) {
      const log = await this.logInference({
        kind: AiInferenceKind.EMBEDDING,
        params: { prompt: sanitized, actorId: params.actorId, actorRole: params.actorRole },
        promptText: sanitized,
        success: false,
        errorMessage: 'rate_limited',
      });
      return { available: false, logId: log.id, errorMessage: 'Rate limit exceeded' };
    }

    const model = params.model ?? (await this.resolveDefaultModel('EMBEDDING'));

    try {
      const response = await this.dgxClient.embed({ text: sanitized, model });

      const log = await this.logInference({
        kind: AiInferenceKind.EMBEDDING,
        params: { prompt: sanitized, actorId: params.actorId, actorRole: params.actorRole },
        promptText: sanitized,
        modelName: response.model,
        latencyMs: response.latencyMs,
        success: true,
      });

      return {
        available: true,
        embedding: response.embedding,
        model: response.model,
        dims: response.dims,
        latencyMs: response.latencyMs,
        logId: log.id,
      };
    } catch (err) {
      const errorMessage = err instanceof DgxUnavailableError ? err.message : (err as Error).message;
      this.logger.warn(`embed() failed: ${errorMessage}`);
      const log = await this.logInference({
        kind: AiInferenceKind.EMBEDDING,
        params: { prompt: sanitized, actorId: params.actorId, actorRole: params.actorRole },
        promptText: sanitized,
        modelName: model,
        success: false,
        errorMessage,
      });
      return { available: false, logId: log.id, errorMessage };
    }
  }

  private async resolveDefaultModel(kind: 'GENERATION' | 'EMBEDDING'): Promise<string | undefined> {
    const model = await this.prisma.aiModel.findFirst({ where: { kind, isDefault: true, status: 'ACTIVE' } });
    return model?.name;
  }

  private async logInference(args: {
    kind: AiInferenceKind;
    params: { prompt?: string; promptVersionId?: string; actorId?: string; actorRole?: string; correlationId?: string; retrievedDocumentIds?: string[]; confidence?: number; temperature?: number };
    promptText: string;
    responseText?: string;
    modelName?: string;
    tokensIn?: number;
    tokensOut?: number;
    latencyMs?: number;
    success: boolean;
    errorMessage?: string;
  }) {
    const model = args.modelName ? await this.prisma.aiModel.findUnique({ where: { name: args.modelName } }) : null;

    return this.prisma.aiInferenceLog.create({
      data: {
        kind: args.kind,
        modelId: model?.id,
        promptVersionId: args.params.promptVersionId,
        actorId: args.params.actorId,
        actorRole: args.params.actorRole,
        correlationId: args.params.correlationId,
        promptText: args.promptText.slice(0, 4000),
        responseText: args.responseText?.slice(0, 4000),
        temperature: args.params.temperature,
        tokensIn: args.tokensIn,
        tokensOut: args.tokensOut,
        latencyMs: args.latencyMs,
        confidence: args.params.confidence,
        retrievedDocumentIds: args.params.retrievedDocumentIds ?? undefined,
        success: args.success,
        errorMessage: args.errorMessage,
      },
    });
  }
}
