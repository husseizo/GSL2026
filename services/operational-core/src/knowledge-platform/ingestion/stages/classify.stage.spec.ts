import { classifyContent } from './classify.stage';

describe('classifyContent', () => {
  it('confidently classifies a real torque-specification sentence', () => {
    const result = classifyContent('Tighten the crankshaft bolt to a torque of 120 Nm.');
    expect(result.itemType).toBe('TORQUE_SPECIFICATION');
    expect(result.confident).toBe(true);
  });

  it('confidently classifies a real technical bulletin', () => {
    const result = classifyContent('Technical Service Bulletin TSB-2024-01 affects all model year 2020 vehicles.');
    expect(result.itemType).toBe('TECHNICAL_BULLETIN');
    expect(result.confident).toBe(true);
  });

  it('classifies ambiguous content as OTHER with confident=false when nothing matches', () => {
    const result = classifyContent('The sky was a pleasant shade of blue that afternoon.');
    expect(result.itemType).toBe('OTHER');
    expect(result.confident).toBe(false);
  });

  it('flags multi-keyword matches as not confident, never silently picking one', () => {
    const result = classifyContent('This repair procedure requires torque of 50 Nm and fresh lubricant fluid.');
    expect(result.confident).toBe(false);
  });
});
