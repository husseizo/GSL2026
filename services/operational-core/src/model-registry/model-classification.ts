// Pure classification of an Ollama model tag into this registry's
// kind/family fields — no DB, no network. Used both when syncing real
// models from the DGX service and in tests. New model families just need a
// new keyword here, not a schema change (`family` is a free-text column).
const FAMILY_KEYWORDS: { family: string; keywords: string[] }[] = [
  { family: 'LLAMA', keywords: ['llama'] },
  { family: 'QWEN', keywords: ['qwen'] },
  { family: 'DEEPSEEK', keywords: ['deepseek'] },
  { family: 'MISTRAL', keywords: ['mistral'] },
  { family: 'GEMMA', keywords: ['gemma'] },
  { family: 'PHI', keywords: ['phi'] },
  { family: 'NOMIC', keywords: ['nomic'] },
];

export function inferModelFamily(modelName: string): string {
  const lower = modelName.toLowerCase();
  const match = FAMILY_KEYWORDS.find((f) => f.keywords.some((k) => lower.includes(k)));
  return match?.family ?? 'OTHER';
}

export function inferModelKind(modelName: string): 'GENERATION' | 'EMBEDDING' {
  const lower = modelName.toLowerCase();
  return lower.includes('embed') ? 'EMBEDDING' : 'GENERATION';
}

// e.g. "llama3:8b-instruct-q4_0" -> "q4_0"; undefined if no quantization tag present.
export function inferQuantization(modelName: string): string | undefined {
  const match = modelName.match(/q\d[a-z0-9_]*/i);
  return match?.[0];
}
