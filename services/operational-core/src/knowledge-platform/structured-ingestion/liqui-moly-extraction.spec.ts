import { buildLiquiMolySummaryText, extractLiquiMolyFacts, LiquiMolyProductRow } from './liqui-moly-extraction';

const baseRow: LiquiMolyProductRow = {
  ArticleNumber: '1024',
  Name: 'Fully Synthetic Hypoid Gear Oil (GL4/5) 75W-90',
  Category: 'Gear Oils',
  SpecGrade: '75W-90',
  PackagingSize: '1 l',
  Liter: 1,
  Approvals: null,
  Specifications: null,
  SpecificationItems: null,
};

describe('liqui-moly-extraction', () => {
  it('preserves the original SpecGrade string verbatim (5W-30 must not become 5W30)', () => {
    const facts = extractLiquiMolyFacts({ ...baseRow, SpecGrade: '5W-30' });
    const fluidTypeFact = facts.find((f) => f.factType === 'FLUID_TYPE');
    expect(fluidTypeFact?.value.grade).toBe('5W-30');
  });

  it('extracts real approvals as OEM_APPROVAL facts, distinct from industry specifications', () => {
    const facts = extractLiquiMolyFacts({ ...baseRow, Approvals: JSON.stringify(['ZF TE-ML 16D', 'MIL-L 2105 D']), SpecificationItems: JSON.stringify(['API GL5']) });
    const approvalFacts = facts.filter((f) => f.factType === 'LUBRICANT_APPROVAL' && (f.conditions as { kind?: string })?.kind === 'OEM_APPROVAL');
    const specFacts = facts.filter((f) => f.factType === 'LUBRICANT_APPROVAL' && (f.conditions as { kind?: string })?.kind === 'INDUSTRY_SPECIFICATION');
    expect(approvalFacts.length).toBe(2);
    expect(specFacts.length).toBe(1);
  });

  it('handles a real row with SpecGrade null (the ~67% real-data case) without crashing, producing fewer facts', () => {
    const facts = extractLiquiMolyFacts({ ...baseRow, SpecGrade: null, Liter: null, PackagingSize: null });
    expect(facts.find((f) => f.factType === 'FLUID_TYPE')).toBeUndefined();
  });

  it('never includes Description/ImageUrl/ProductUrl content in the summary text', () => {
    const text = buildLiquiMolySummaryText(baseRow);
    expect(text).not.toContain('liqui-moly.com');
    expect(text).toContain('75W-90');
  });

  it('gracefully returns no facts for malformed JSON in Approvals', () => {
    const facts = extractLiquiMolyFacts({ ...baseRow, Approvals: 'not valid json' });
    expect(facts.filter((f) => f.factType === 'LUBRICANT_APPROVAL').length).toBe(0);
  });
});
