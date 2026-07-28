import { extractEntities } from './entity-extractor';

describe('entity-extractor', () => {
  it('extracts a real embedded identifier from a longer free-text sentence', () => {
    const entities = extractEntities('Do you have part MB100111 in stock?');
    expect(entities.some((e) => e.token === 'MB100111' && e.queryClass === 'INTERNAL_ITEM_CODE')).toBe(true);
  });

  it('extracts a real VIN from a sentence containing one', () => {
    const entities = extractEntities('Please look up SALGA2FE8HA123456 for me');
    expect(entities.some((e) => e.token === 'SALGA2FE8HA123456' && e.queryClass === 'VEHICLE_VIN')).toBe(true);
  });

  it('does not extract ordinary English words as entities', () => {
    const entities = extractEntities('I need the part with number for my car');
    expect(entities.length).toBe(0);
  });

  it('extracts multiple real identifiers from the same sentence', () => {
    const entities = extractEntities('Compare MB100111 with VAG12695 please');
    expect(entities.map((e) => e.token)).toEqual(expect.arrayContaining(['MB100111', 'VAG12695']));
  });
});
