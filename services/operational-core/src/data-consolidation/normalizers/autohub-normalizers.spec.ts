import { normalizeAutoHubPart, normalizeAutoHubSalesOrder } from './autohub-normalizers';

describe('normalizeAutoHubPart', () => {
  it('maps a real oitm row, preferring canonical_oem_number for identity', () => {
    const result = normalizeAutoHubPart({
      item_code: 'BM10506',
      article_number: '7PK1635',
      canonical_oem_number: '11281432724',
      name: 'V-Ribbed Belt',
      part_group: 'Engine',
      sell_price_tzs: '70000.00',
      supplier_name: 'TOP DRIVE',
    });
    expect(result.resolvedOemNumber).toBe('11281432724');
    expect(result.oemNumber).toBe('11281432724');
    expect(result.itemCode).toBe('BM10506');
    expect(result.sellingPrice).toBe(70000);
    expect(result.brand).toBe('TOP DRIVE');
  });

  it('falls back through article_number then item_code when canonical_oem_number is missing', () => {
    const result = normalizeAutoHubPart({ item_code: 'X1', article_number: null, canonical_oem_number: null, name: 'Unknown part', part_group: null, sell_price_tzs: null, supplier_name: null });
    expect(result.resolvedOemNumber).toBe('X1');
    expect(result.oemNumber).toBeNull();
  });
});

describe('normalizeAutoHubSalesOrder', () => {
  it('maps a real NeonAutoHubSalesOrders row', () => {
    const result = normalizeAutoHubSalesOrder({ DocEntry: 10954, CardCode: '0001', CardName: 'Cash', DocDate: '2024-06-03T00:00:00.000Z', DocStatus: 'C', DocTotal: '1000000.00' });
    expect(result.sourceRecordId).toBe('10954');
    expect(result.cardCode).toBe('0001');
    expect(result.docTotal).toBe(1000000);
  });
});
