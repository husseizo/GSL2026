import { parseCsv } from './csv.parser';

describe('parseCsv', () => {
  it('preserves real CSV content structurally as a table, never flattened into prose', () => {
    const result = parseCsv('part,torque_nm\nA123,45\nB456,60', 'fallback');
    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].headers).toEqual(['part', 'torque_nm']);
    expect(result.tables[0].rows).toEqual([
      ['A123', '45'],
      ['B456', '60'],
    ]);
  });

  it('handles a real quoted field containing a comma', () => {
    const result = parseCsv('name,note\n"Part, special",ok', 'fallback');
    expect(result.tables[0].rows[0]).toEqual(['Part, special', 'ok']);
  });
});
