import { Module } from '@nestjs/common';
import { AiGatewayService } from './ai-gateway.service';
import { DgxClientService } from './dgx-client.service';
import { RateLimiterService } from './rate-limiter.service';

// The AI Gateway is a pure service layer (no controllers of its own) — every
// higher-level AI module (RAG, assistants, embeddings, model registry's GPU
// health check) imports this and calls through AiGatewayService/DgxClientService
// rather than reaching Ollama or the DGX FastAPI service directly. See
// docs/architecture/dgx-platform.md.
@Module({
  providers: [AiGatewayService, DgxClientService, RateLimiterService],
  exports: [AiGatewayService, DgxClientService, RateLimiterService],
})
export class AiGatewayModule {}
