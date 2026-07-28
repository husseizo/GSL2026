// Pure functions building the structured text representation embedded per
// catalogue record — no raw transactional/financial/customer data, per the
// spec's explicit rule. See docs/ai/catalogue-corpus-contract.md.
export interface PartCorpusFields {
  internalItemCode: string | null;
  oemNumber: string;
  alternateNumbers: string[];
  tecdocArticleId: string | null;
  brand: string | null;
  productName: string;
  category: string | null;
  subcategory: string | null;
}

export function buildPartCorpusText(fields: PartCorpusFields): string {
  const lines = [
    `Part: ${fields.productName}`,
    `Internal code: ${fields.internalItemCode ?? 'unknown'}`,
    `OEM number: ${fields.oemNumber}`,
    fields.alternateNumbers.length > 0 ? `Alternate numbers: ${fields.alternateNumbers.join(', ')}` : null,
    fields.tecdocArticleId ? `TecDoc identifier: ${fields.tecdocArticleId}` : null,
    fields.brand ? `Brand: ${fields.brand}` : null,
    fields.category ? `Category: ${fields.category}${fields.subcategory ? ` / ${fields.subcategory}` : ''}` : null,
  ].filter((line): line is string => line !== null);
  return lines.join('\n');
}

export interface LubricantCorpusFields {
  internalCode: string | null;
  brand: string;
  productName: string;
  category: string;
  viscosity: string | null;
  packageSize: string | null;
  packageUnit: string | null;
  apiClassification: string | null;
  aceaClassification: string | null;
  verifiedApprovals: { oemBrand: string; approvalCode: string }[];
}

export function buildLubricantCorpusText(fields: LubricantCorpusFields): string {
  const lines = [
    `Lubricant: ${fields.productName}`,
    `Internal code: ${fields.internalCode ?? 'unknown'}`,
    `Brand: ${fields.brand}`,
    `Category: ${fields.category}`,
    fields.viscosity ? `Viscosity (parsed, unverified unless stated otherwise): ${fields.viscosity}` : null,
    fields.packageSize ? `Package size: ${fields.packageSize} ${fields.packageUnit ?? ''}`.trim() : null,
    fields.apiClassification ? `API classification (parsed, unverified unless stated otherwise): ${fields.apiClassification}` : null,
    fields.aceaClassification ? `ACEA classification (parsed, unverified unless stated otherwise): ${fields.aceaClassification}` : null,
    fields.verifiedApprovals.length > 0
      ? `Verified OEM approvals: ${fields.verifiedApprovals.map((a) => `${a.oemBrand} ${a.approvalCode}`).join(', ')}`
      : 'No verified OEM approvals on record for this product.',
  ].filter((line): line is string => line !== null);
  return lines.join('\n');
}
