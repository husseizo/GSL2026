import { Injectable } from '@nestjs/common';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { PromptRegistryService } from '../prompt-registry/prompt-registry.service';
import { VectorSearchFilter } from '../vector-search/vector-index.provider';
import { VectorSearchService } from '../vector-search/vector-search.service';
import { computeGroundingScore } from './grounding-score';
import { computeRetrievalConfidence } from './rag-confidence';

export interface RagAnswerSource {
  documentId: string;
  title: string;
  sourceType: string;
  excerpt: string;
  score: number;
}

export interface RagAnswer {
  available: boolean;
  answer: string | null;
  sources: RagAnswerSource[];
  confidence: string;
  reasoningSummary: string;
  evidenceRanking: { documentId: string; title: string; score: number }[];
  missingInformation: string[];
  // Lexical-overlap hallucination-monitoring signal (0-1) — see
  // grounding-score.ts. Undefined when there was no generated answer to
  // score (unavailable / no-evidence responses).
  groundingScore?: number;
  logId?: string;
}

export interface RetrieveAndGenerateParams {
  query: string;
  filter?: VectorSearchFilter;
  actorId?: string;
  correlationId?: string;
  promptTemplateName: string;
  variables?: Record<string, string>;
}

// "The assistant must answer only from approved knowledge... never
// hallucinate." Concretely: retrieval happens first and always; if nothing
// relevant is found, the LLM is never even called — there is nothing to
// hallucinate an answer from. If retrieval is weak, the LLM is called but
// explicitly instructed to say so rather than guess, and the response is
// tagged with LOW confidence so a caller can render that distinctly. See
// docs/architecture/rag-architecture.md.
//
// retrieveAndGenerate() is the shared retrieval+generation engine —
// answer() (plain chat/search) and every AI assistant (technician, parts,
// lubricant, manager) all go through this one method with a different
// prompt template and extra variables, rather than each reimplementing
// "embed query, search, build context, call the LLM."
@Injectable()
export class RagService {
  constructor(
    private readonly aiGateway: AiGatewayService,
    private readonly vectorSearch: VectorSearchService,
    private readonly promptRegistry: PromptRegistryService,
  ) {}

  async answer(question: string, filter?: VectorSearchFilter, actorId?: string, correlationId?: string): Promise<RagAnswer> {
    await this.ensurePromptSeeded('RAG_ANSWER', {
      systemPrompt:
        'You are an automotive knowledge assistant. Answer ONLY using the provided evidence context. Never invent facts not present in the evidence. If the evidence is insufficient, say so explicitly rather than guessing.',
      userPromptTemplate:
        'Question: {{question}}\n\nEvidence:\n{{context}}\n\nInstruction: {{uncertaintyInstruction}}\n\nProvide a concise, evidence-grounded answer.',
      temperature: 0.2,
    });

    return this.retrieveAndGenerate({
      query: question,
      filter,
      actorId,
      correlationId,
      promptTemplateName: 'RAG_ANSWER',
      variables: { question },
    });
  }

  async retrieveAndGenerate(params: RetrieveAndGenerateParams): Promise<RagAnswer> {
    const embedResult = await this.aiGateway.embed({ text: params.query, actorId: params.actorId });
    if (!embedResult.available || !embedResult.embedding) {
      return {
        available: false,
        answer: null,
        sources: [],
        confidence: 'NONE',
        reasoningSummary: 'Embedding service unavailable — cannot retrieve knowledge base evidence.',
        evidenceRanking: [],
        missingInformation: ['DGX embedding service unavailable'],
      };
    }

    // Deliberately semanticSearch(), not hybridSearch(): hybrid's merged
    // score is min-max normalized across whatever candidates were returned,
    // so its top result is always ~1.0 by construction — meaningless as an
    // absolute confidence signal (this was a real bug, caught by an
    // integration test asserting LOW/NONE confidence for an unrelated query
    // and instead observing a hybrid-normalized 1.0). Raw cosine similarity
    // from semanticSearch is the only score with real absolute meaning.
    const hits = await this.vectorSearch.semanticSearch(embedResult.embedding, 5, params.filter);
    const confidence = computeRetrievalConfidence(hits.map((h) => h.score));

    if (hits.length === 0) {
      return {
        available: true,
        answer: 'I do not have enough verified information in the knowledge base to answer this confidently.',
        sources: [],
        confidence: confidence.level,
        reasoningSummary: 'No approved knowledge base documents matched this query.',
        evidenceRanking: [],
        missingInformation: ['No matching approved knowledge base documents'],
      };
    }

    const contextText = hits.map((h, i) => `[${i + 1}] (${h.documentTitle}): ${h.text}`).join('\n\n');
    const uncertaintyInstruction =
      confidence.level === 'LOW' || confidence.level === 'NONE'
        ? 'The retrieved evidence is weak. Clearly state your uncertainty and say what information is missing rather than guessing.'
        : 'Answer only using the evidence provided. If the evidence does not fully answer the question, say so explicitly.';

    const rendered = await this.promptRegistry.render(params.promptTemplateName, {
      ...params.variables,
      context: contextText,
      uncertaintyInstruction,
    });

    const generation = await this.aiGateway.generate({
      prompt: rendered.userPrompt,
      system: rendered.systemPrompt,
      temperature: rendered.temperature,
      maxTokens: rendered.maxTokens,
      promptVersionId: rendered.promptVersionId,
      actorId: params.actorId,
      correlationId: params.correlationId,
      retrievedDocumentIds: hits.map((h) => h.documentId),
      confidence: confidence.topScore,
    });

    const evidenceRanking = hits.map((h) => ({ documentId: h.documentId, title: h.documentTitle, score: Number(h.score.toFixed(4)) }));
    const sources = hits.map((h) => ({
      documentId: h.documentId,
      title: h.documentTitle,
      sourceType: h.sourceType,
      excerpt: h.text.slice(0, 300),
      score: Number(h.score.toFixed(4)),
    }));

    if (!generation.available) {
      return {
        available: false,
        answer: null,
        sources,
        confidence: confidence.level,
        reasoningSummary: 'Generation service unavailable after retrieval succeeded.',
        evidenceRanking,
        missingInformation: ['DGX generation service unavailable'],
      };
    }

    const groundingScore = generation.text ? computeGroundingScore(generation.text, hits.map((h) => h.text)) : undefined;
    const missingInformation =
      confidence.level === 'LOW' || confidence.level === 'NONE'
        ? ['Retrieval confidence is low — treat this answer as tentative']
        : [];
    if (groundingScore !== undefined && groundingScore < 0.3) {
      missingInformation.push('Low lexical grounding — the answer uses substantial vocabulary not present in the retrieved evidence');
    }

    return {
      available: true,
      answer: generation.text ?? null,
      sources,
      confidence: confidence.level,
      reasoningSummary: `Answered from ${hits.length} retrieved chunk(s) with ${confidence.level} retrieval confidence.`,
      evidenceRanking,
      missingInformation,
      groundingScore,
      logId: generation.logId,
    };
  }

  // Self-seeds a prompt template on first use rather than requiring a manual
  // seed step per environment — but still goes through the exact same
  // PromptRegistryService.publishVersion() path, so the resulting
  // PromptVersion is a real, inspectable, versioned row, not a hardcoded
  // string bypassing the registry. Exported so assistant services (which
  // each own a different template) can reuse the same seed-once pattern.
  async ensurePromptSeeded(
    templateName: string,
    defaults: { systemPrompt: string; userPromptTemplate: string; temperature?: number },
  ): Promise<void> {
    try {
      await this.promptRegistry.getActiveVersion(templateName);
    } catch {
      await this.promptRegistry.createTemplate(templateName, templateName).catch(() => undefined);
      await this.promptRegistry.publishVersion(templateName, defaults);
    }
  }
}
