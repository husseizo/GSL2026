import { applyShadowModeLabel, isGenerationEnabled, isShadowModeEnabled, requiresShadowModeReview } from './shadow-mode';

describe('shadow-mode flags', () => {
  const originalShadow = process.env.CATALOGUE_RAG_SHADOW_MODE;
  const originalGeneration = process.env.CATALOGUE_RAG_GENERATION_ENABLED;

  afterEach(() => {
    process.env.CATALOGUE_RAG_SHADOW_MODE = originalShadow;
    process.env.CATALOGUE_RAG_GENERATION_ENABLED = originalGeneration;
  });

  it('defaults to shadow mode enabled when the env var is unset', () => {
    delete process.env.CATALOGUE_RAG_SHADOW_MODE;
    expect(isShadowModeEnabled()).toBe(true);
  });

  it('disables shadow mode only when explicitly set to the string "false"', () => {
    process.env.CATALOGUE_RAG_SHADOW_MODE = 'false';
    expect(isShadowModeEnabled()).toBe(false);
  });

  it('defaults to generation enabled when the env var is unset', () => {
    delete process.env.CATALOGUE_RAG_GENERATION_ENABLED;
    expect(isGenerationEnabled()).toBe(true);
  });

  it('the kill switch disables generation only when explicitly set to "false"', () => {
    process.env.CATALOGUE_RAG_GENERATION_ENABLED = 'false';
    expect(isGenerationEnabled()).toBe(false);
  });
});

describe('applyShadowModeLabel', () => {
  it('prefixes the answer with a real, visible shadow-mode label', () => {
    expect(applyShadowModeLabel('The part is X.')).toMatch(/^\[AI explanation/);
    expect(applyShadowModeLabel('The part is X.')).toContain('The part is X.');
  });
});

describe('requiresShadowModeReview', () => {
  it('requires review for LOW, CONFLICTING, and INSUFFICIENT_EVIDENCE', () => {
    expect(requiresShadowModeReview('LOW')).toBe(true);
    expect(requiresShadowModeReview('CONFLICTING')).toBe(true);
    expect(requiresShadowModeReview('INSUFFICIENT_EVIDENCE')).toBe(true);
  });

  it('does not require review for MEDIUM/HIGH/VERIFIED', () => {
    expect(requiresShadowModeReview('MEDIUM')).toBe(false);
    expect(requiresShadowModeReview('HIGH')).toBe(false);
    expect(requiresShadowModeReview('VERIFIED')).toBe(false);
  });
});
