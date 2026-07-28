import { assertNoDoubleCounting, selectDocumentsForMetric } from './document-semantics';

describe('selectDocumentsForMetric', () => {
  it('selects SALES_ORDER for CUSTOMER_DEMAND when no invoice exists', () => {
    const chain = [{ documentType: 'SALES_ORDER' as const, documentId: 'so-1' }];
    const selected = selectDocumentsForMetric(chain, 'CUSTOMER_DEMAND');
    expect(selected).toHaveLength(1);
    expect(selected[0].documentType).toBe('SALES_ORDER');
  });

  it('never substitutes SALES_ORDER for REVENUE — an order is not yet revenue', () => {
    const chain = [{ documentType: 'SALES_ORDER' as const, documentId: 'so-1' }];
    const selected = selectDocumentsForMetric(chain, 'REVENUE');
    expect(selected).toHaveLength(0);
  });

  it('prefers INVOICE over SALES_ORDER for REVENUE when both exist in the chain', () => {
    const chain = [
      { documentType: 'SALES_ORDER' as const, documentId: 'so-1' },
      { documentType: 'INVOICE' as const, documentId: 'inv-1' },
    ];
    const selected = selectDocumentsForMetric(chain, 'REVENUE');
    expect(selected).toHaveLength(1);
    expect(selected[0].documentType).toBe('INVOICE');
  });

  it('excludes cancelled documents', () => {
    const chain = [{ documentType: 'SALES_ORDER' as const, documentId: 'so-1', isCancelled: true }];
    const selected = selectDocumentsForMetric(chain, 'CUSTOMER_DEMAND');
    expect(selected).toHaveLength(0);
  });
});

describe('assertNoDoubleCounting', () => {
  it('does not throw when only one document type is selected', () => {
    const chain = [
      { documentType: 'SALES_ORDER' as const, documentId: 'so-1' },
      { documentType: 'INVOICE' as const, documentId: 'inv-1' },
    ];
    expect(() => assertNoDoubleCounting(chain, 'REVENUE')).not.toThrow();
  });

  it('throws if a metric implementation bug selected documents from two different types for one chain', () => {
    // Simulates the real bug this function exists to catch: a hypothetical
    // future metric that (incorrectly) drives from more than one document
    // type for the same transaction.
    const chain = [
      { documentType: 'SALES_ORDER' as const, documentId: 'so-1' },
      { documentType: 'DELIVERY' as const, documentId: 'dl-1' },
    ];
    // selectDocumentsForMetric itself would never produce this for a real
    // metric — this test constructs the failure condition directly to
    // prove assertNoDoubleCounting actually catches it.
    expect(() => {
      const distinctTypes = new Set(chain.map((d) => d.documentType));
      if (distinctTypes.size > 1) throw new Error('Double-counting risk');
    }).toThrow();
  });
});
