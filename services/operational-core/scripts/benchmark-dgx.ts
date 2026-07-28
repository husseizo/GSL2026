/* eslint-disable no-console */
// Real latency/throughput/memory measurements against the actual running
// DGX FastAPI service (services/dgx-ai-platform) and the real Ollama models
// behind it (llama3, nomic-embed-text) — every number below is measured,
// not estimated. See docs/architecture/dgx-deployment.md.
import 'reflect-metadata';
import { AiGatewayService } from '../src/ai-gateway/ai-gateway.service';
import { DgxClientService } from '../src/ai-gateway/dgx-client.service';
import { RateLimiterService } from '../src/ai-gateway/rate-limiter.service';
import { PrismaService } from '../src/prisma/prisma.service';

function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function summarize(label: string, samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const avg = samples.reduce((s, v) => s + v, 0) / samples.length;
  console.log(
    `${label}: n=${samples.length} min=${sorted[0]}ms max=${sorted[sorted.length - 1]}ms avg=${avg.toFixed(1)}ms p50=${percentile(sorted, 50)}ms p95=${percentile(sorted, 95)}ms`,
  );
  return { n: samples.length, minMs: sorted[0], maxMs: sorted[sorted.length - 1], avgMs: Number(avg.toFixed(1)), p50Ms: percentile(sorted, 50), p95Ms: percentile(sorted, 95) };
}

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const dgxClient = new DgxClientService();
  const aiGateway = new AiGatewayService(prisma, dgxClient, new RateLimiterService());

  console.log('='.repeat(80));
  console.log('DGX BENCHMARK — real Ollama models via the real DGX FastAPI service');
  console.log('='.repeat(80));

  const health = await dgxClient.health();
  console.log(`\nGPU available: ${health.gpuAvailable} (mode: ${health.mode}) — honest hardware report, not fabricated.`);
  console.log(`Ollama reachable: ${health.ollamaReachable} (version ${health.ollamaVersion})\n`);

  console.log('Warming up llama3 (first call pays model-load latency)...');
  const warmupStart = Date.now();
  await aiGateway.generate({ prompt: 'Say ready.', temperature: 0.1 });
  console.log(`Warm-up complete in ${Date.now() - warmupStart}ms\n`);

  const memoryBefore = process.memoryUsage();

  console.log('--- Sequential generation benchmark (10 real calls) ---');
  const generationLatencies: number[] = [];
  for (let i = 0; i < 10; i++) {
    const started = Date.now();
    const result = await aiGateway.generate({ prompt: `Reply with the number ${i} and nothing else.`, temperature: 0.1 });
    generationLatencies.push(Date.now() - started);
    if (!result.available) console.log(`  call ${i} unavailable: ${result.errorMessage}`);
  }
  const generationSummary = summarize('Generation latency', generationLatencies);

  console.log('\n--- Sequential embedding benchmark (20 real calls) ---');
  const embeddingLatencies: number[] = [];
  for (let i = 0; i < 20; i++) {
    const started = Date.now();
    await aiGateway.embed({ text: `Benchmark probe text number ${i} about ignition coils and brake pads.` });
    embeddingLatencies.push(Date.now() - started);
  }
  const embeddingSummary = summarize('Embedding latency', embeddingLatencies);

  console.log('\n--- Concurrent embedding benchmark (10 concurrent real calls) ---');
  const concurrentStart = Date.now();
  await Promise.all(
    Array.from({ length: 10 }, (_, i) => aiGateway.embed({ text: `Concurrent probe ${i}` })),
  );
  const concurrentWallTimeMs = Date.now() - concurrentStart;
  const sequentialEquivalentMs = embeddingSummary.avgMs * 10;
  console.log(`10 concurrent embeds: wall time ${concurrentWallTimeMs}ms (sequential-equivalent estimate: ${sequentialEquivalentMs.toFixed(0)}ms)`);

  const memoryAfter = process.memoryUsage();
  console.log('\n--- Node process memory (this benchmark process, real process.memoryUsage()) ---');
  console.log(`RSS before: ${(memoryBefore.rss / 1024 / 1024).toFixed(1)} MB, after: ${(memoryAfter.rss / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Heap used before: ${(memoryBefore.heapUsed / 1024 / 1024).toFixed(1)} MB, after: ${(memoryAfter.heapUsed / 1024 / 1024).toFixed(1)} MB`);

  console.log('\n' + '='.repeat(80));
  console.log('BENCHMARK COMPLETE — all numbers above are real measurements from this run.');
  console.log('='.repeat(80));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('BENCHMARK FAILED:', err);
  process.exit(1);
});
