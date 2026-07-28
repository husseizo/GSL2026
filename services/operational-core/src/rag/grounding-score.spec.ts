import { computeGroundingScore } from './grounding-score';

describe('computeGroundingScore', () => {
  it('returns a high score when the answer closely echoes the source vocabulary', () => {
    const answer = 'Replace the ignition coil to fix the misfire on cylinder three.';
    const sources = ['A failed ignition coil is a common cause of a misfire on cylinder three; replace the coil.'];
    expect(computeGroundingScore(answer, sources)).toBeGreaterThan(0.7);
  });

  it('returns a low score when the answer uses vocabulary absent from any source', () => {
    const answer = 'You should repaint the spaceship hull and recalibrate the warp core immediately.';
    const sources = ['A failed ignition coil is a common cause of a misfire on cylinder three.'];
    expect(computeGroundingScore(answer, sources)).toBeLessThan(0.3);
  });

  it('returns 1 for an empty answer (nothing ungrounded to flag)', () => {
    expect(computeGroundingScore('', ['some source text'])).toBe(1);
  });

  it('returns 0 when there are no sources at all but the answer has content', () => {
    expect(computeGroundingScore('some real answer content here', [])).toBe(0);
  });
});
