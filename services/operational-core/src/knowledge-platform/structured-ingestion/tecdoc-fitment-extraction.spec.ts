import { buildTecdocArticleSummaryText, extractTecdocArticleFacts, buildFitmentGraphEdge, TecdocArticleRow, TecdocArticleVehicleRow } from './tecdoc-fitment-extraction';

const baseArticle: TecdocArticleRow = {
  tecdoc_article_id: 3379347,
  article_number: '45050054901',
  name: 'Link/Coupling Rod, stabiliser bar',
  supplier_name: 'vika',
  canonical_oem_number: '1K0505465AA',
  ean_barcode: '6923570448819',
  weight_kg: '0.35',
  part_group: 'Suspension & Axle',
  part_component: 'Stabiliser Bar Link/Coupling Rod',
};

describe('tecdoc-fitment-extraction', () => {
  it('never includes image_url content in the summary text', () => {
    const text = buildTecdocArticleSummaryText(baseArticle);
    expect(text).toContain('1K0505465AA');
    expect(text).not.toContain('http');
  });

  it('extracts a real fitment fact keyed by the canonical OEM number', () => {
    const facts = extractTecdocArticleFacts(baseArticle);
    const fitmentFact = facts.find((f) => f.factType === 'FITMENT');
    expect(fitmentFact?.value.canonicalOemNumber).toBe('1K0505465AA');
  });

  it('excludes a zero-weight fact (real data has weight_kg=0 rows) rather than a bogus PART_DIMENSION fact', () => {
    const facts = extractTecdocArticleFacts({ ...baseArticle, weight_kg: '0' });
    expect(facts.find((f) => f.factType === 'PART_DIMENSION')).toBeUndefined();
  });

  it('builds a deterministic, honestly-labeled fitment graph edge from a real row', () => {
    const row: TecdocArticleVehicleRow = { article_id: 1, vehicle_id: 6030, model_id: 4955 };
    const edge = buildFitmentGraphEdge(row);
    expect(edge.partRefId).toBe('1');
    expect(edge.vehicleRefId).toBe('6030');
    expect(edge.vehicleLabel).toContain('6030');
  });
});
