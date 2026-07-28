import { Injectable } from '@nestjs/common';

// The only class in the entire NestJS app that talks to the DGX inference
// boundary (services/dgx-ai-platform). Everything else — RAG, assistants,
// embeddings — goes through AiGatewayService, which goes through this. See
// docs/architecture/dgx-platform.md.
//
// Points at DGX_SERVICE_URL (default http://127.0.0.1:8800, this sandbox's
// FastAPI port — 8000 is reserved by Windows on this box). On a real DGX
// Spark this env var just points at wherever the same FastAPI service is
// deployed there; no code here changes.
export class DgxUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DgxUnavailableError';
  }
}

export interface DgxGenerateRequest {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  // Additive (DGX Prototype 1.5): passed straight through to Ollama's own
  // `format` option when set to 'json', constraining decoding to valid
  // JSON. Unset by default — identical behavior to before for every
  // existing caller. See docs/ai-tuning/claim-verification.md.
  format?: 'json';
}

export interface DgxGenerateResponse {
  text: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
}

export interface DgxEmbedRequest {
  text: string;
  model?: string;
}

export interface DgxEmbedResponse {
  embedding: number[];
  model: string;
  dims: number;
  latencyMs: number;
}

export interface DgxHealthResponse {
  status: string;
  version: string;
  mode: string;
  gpuAvailable: boolean;
  gpuDevices: unknown[];
  ollamaReachable: boolean;
  ollamaVersion?: string;
}

export interface DgxModelInfo {
  name: string;
  sizeBytes: number;
  modifiedAt?: string;
  digest?: string;
}

@Injectable()
export class DgxClientService {
  private readonly baseUrl = process.env.DGX_SERVICE_URL ?? 'http://127.0.0.1:8800';

  async generate(req: DgxGenerateRequest): Promise<DgxGenerateResponse> {
    return this.post<DgxGenerateResponse>('/v1/generate', req, 180_000);
  }

  async embed(req: DgxEmbedRequest): Promise<DgxEmbedResponse> {
    return this.post<DgxEmbedResponse>('/v1/embed', req, 60_000);
  }

  async health(): Promise<DgxHealthResponse> {
    return this.get<DgxHealthResponse>('/v1/health', 5_000);
  }

  async models(): Promise<DgxModelInfo[]> {
    return this.get<DgxModelInfo[]>('/v1/models', 10_000);
  }

  private async post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new DgxUnavailableError(`DGX service ${path} returned ${res.status}: ${await safeText(res)}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof DgxUnavailableError) throw err;
      throw new DgxUnavailableError(`DGX service ${path} unreachable: ${(err as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async get<T>(path: string, timeoutMs: number): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, { signal: controller.signal });
      if (!res.ok) {
        throw new DgxUnavailableError(`DGX service ${path} returned ${res.status}: ${await safeText(res)}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof DgxUnavailableError) throw err;
      throw new DgxUnavailableError(`DGX service ${path} unreachable: ${(err as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '<unreadable body>';
  }
}
