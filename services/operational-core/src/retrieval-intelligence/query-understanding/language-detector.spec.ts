import { detectLanguage } from './language-detector';

describe('language-detector', () => {
  it('detects a real, human-verified Swahili template (DGX 1.6 benchmark vocabulary) as Swahili', () => {
    const result = detectLanguage('Nataka sehemu yenye namba 036145933G');
    expect(result.language).toBe('sw');
    expect(result.swahiliWordCount).toBeGreaterThan(0);
  });

  it('detects an ordinary English workshop request as English', () => {
    const result = detectLanguage('I need the part with number 12345');
    expect(result.language).toBe('en');
  });

  it('detects a real code-switched Swahili/English phrase as mixed', () => {
    const result = detectLanguage('Naomba part number 12345 kwa gari langu');
    expect(result.language).toBe('mixed');
    expect(result.swahiliWordCount).toBeGreaterThan(0);
    expect(result.englishWordCount).toBeGreaterThan(0);
  });

  it('returns unknown for text with no recognizable Swahili or English words, never guessing', () => {
    const result = detectLanguage('034106898723');
    expect(result.language).toBe('unknown');
  });
});
