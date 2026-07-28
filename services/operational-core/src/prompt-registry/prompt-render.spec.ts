import { renderPromptTemplate } from './prompt-render';

describe('renderPromptTemplate', () => {
  it('substitutes all known variables', () => {
    const result = renderPromptTemplate('VIN {{vin}} reported symptom: {{symptom}}', { vin: 'WBA123', symptom: 'rough idle' });
    expect(result.rendered).toBe('VIN WBA123 reported symptom: rough idle');
    expect(result.missingVariables).toEqual([]);
  });

  it('reports missing variables and substitutes them with an empty string', () => {
    const result = renderPromptTemplate('VIN {{vin}}, DTC {{dtc}}', { vin: 'WBA123' });
    expect(result.rendered).toBe('VIN WBA123, DTC ');
    expect(result.missingVariables).toEqual(['dtc']);
  });

  it('deduplicates a variable referenced more than once', () => {
    const result = renderPromptTemplate('{{name}} and {{name}} again', {});
    expect(result.missingVariables).toEqual(['name']);
  });

  it('leaves a template with no placeholders unchanged', () => {
    const result = renderPromptTemplate('Plain instruction, no variables here', {});
    expect(result.rendered).toBe('Plain instruction, no variables here');
    expect(result.missingVariables).toEqual([]);
  });
});
