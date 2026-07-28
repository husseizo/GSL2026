import { inferModelFamily, inferModelKind, inferQuantization } from './model-classification';

describe('model-classification', () => {
  it('classifies llama3:latest as LLAMA/GENERATION', () => {
    expect(inferModelFamily('llama3:latest')).toBe('LLAMA');
    expect(inferModelKind('llama3:latest')).toBe('GENERATION');
  });

  it('classifies nomic-embed-text:latest as NOMIC/EMBEDDING', () => {
    expect(inferModelFamily('nomic-embed-text:latest')).toBe('NOMIC');
    expect(inferModelKind('nomic-embed-text:latest')).toBe('EMBEDDING');
  });

  it('classifies qwen2.5:0.5b-instruct as QWEN/GENERATION', () => {
    expect(inferModelFamily('qwen2.5:0.5b-instruct')).toBe('QWEN');
    expect(inferModelKind('qwen2.5:0.5b-instruct')).toBe('GENERATION');
  });

  it('falls back to OTHER for an unrecognized family', () => {
    expect(inferModelFamily('some-custom-model:latest')).toBe('OTHER');
  });

  it('extracts a quantization tag when present', () => {
    expect(inferQuantization('llama3:8b-instruct-q4_0')).toBe('q4_0');
    expect(inferQuantization('llama3:latest')).toBeUndefined();
  });
});
