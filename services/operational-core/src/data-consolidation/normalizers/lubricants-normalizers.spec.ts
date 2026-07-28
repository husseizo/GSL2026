import { isSentinelDate, normalizeLubricantsCustomer, normalizeLubricantsProduct, normalizeLubricantsSalesOrder } from './lubricants-normalizers';

describe('normalizeLubricantsCustomer', () => {
  it('maps real CacheCustomers column shapes into the canonical candidate shape', () => {
    const result = normalizeLubricantsCustomer({ CardCode: 'C10004', CardName: 'Molygen Garage', IsActive: true, Phone1: '+255712345678', Email: '', PriceList: 1, BillToCountry: 'TZ' });
    expect(result.sourceSystem).toBe('MOLAS_CACHE_LUBRICANTS');
    expect(result.sourceRecordId).toBe('C10004');
    expect(result.legalName).toBe('Molygen Garage');
    expect(result.phone).toBe('+255712345678');
    expect(result.email).toBeNull();
    expect(result.pricingGroup).toBe('1');
  });

  it('falls back to the customer code when CardName is blank', () => {
    const result = normalizeLubricantsCustomer({ CardCode: 'C99999', CardName: '', IsActive: true });
    expect(result.legalName).toBe('C99999');
  });
});

describe('normalizeLubricantsProduct', () => {
  it('maps real CacheProducts column shapes, never inferring a brand', () => {
    const result = normalizeLubricantsProduct({ ItemCode: '1015', ItemName: '1015-Molygen Motor Protect-500 ml', IsActive: true, PriceList_1: 93220.34, WarehouseCode: '01' });
    expect(result.itemCode).toBe('1015');
    expect(result.productName).toBe('1015-Molygen Motor Protect-500 ml');
    expect(result.brand).toBeNull();
    expect(result.sellingPrice).toBe(93220.34);
  });
});

describe('normalizeLubricantsSalesOrder', () => {
  it('maps real CacheSalesOrders column shapes, including the CustomerCode/CardCode naming inconsistency', () => {
    const result = normalizeLubricantsSalesOrder({ SapDocEntry: 2386, CustomerCode: 'C10004', DocStatus: 'O', DocDate: '2026-06-01T00:00:00.000Z', DocTotal: 150000 });
    expect(result.sourceRecordId).toBe('2386');
    expect(result.customerCode).toBe('C10004');
    expect(result.docTotal).toBe(150000);
    expect(result.docDate).toEqual(new Date('2026-06-01T00:00:00.000Z'));
  });
});

describe('isSentinelDate', () => {
  it('recognizes the real .NET "never synced" placeholder found in CacheProducts.OdooLastSync', () => {
    expect(isSentinelDate('1899-12-30T00:00:00.000Z')).toBe(true);
  });

  it('does not flag a real date', () => {
    expect(isSentinelDate('2026-07-12T15:00:26.717Z')).toBe(false);
  });

  it('does not flag null/absent values as sentinels', () => {
    expect(isSentinelDate(null)).toBe(false);
    expect(isSentinelDate(undefined)).toBe(false);
  });
});
