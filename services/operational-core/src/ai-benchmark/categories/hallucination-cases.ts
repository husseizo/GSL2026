// DGX Prototype 1.6 — Hallucination Benchmark case generation (spec §12).
//
// Mechanically constructible: take a real part/lubricant and substitute a
// plausible-but-wrong OEM/fitment/approval/compatibility value, then assert
// the system either (a) never asserts the wrong value as fact, or (b)
// flags it as unsupported. This scales into the low hundreds from the real
// corpus without needing per-case human authorship, since "is this
// substituted value real" is a structural fact (it's real if it appears in
// the corpus for a DIFFERENT real entity, wrong if attributed to this one).
import { PrismaService } from '../../prisma/prisma.service';
import { BenchmarkCaseDraft, HallucinationSubScore } from './category-taxonomy';

const HALLUCINATION_CASE_CAP = 200;

export interface HallucinationExecutionSample {
  subtype: HallucinationSubtype;
  assertedAsFact: boolean; // did the real generated answer present substitutedValue as a verified fact of probedEntityId?
}

// Pure aggregation — reused by benchmark-pipeline.service.ts after it
// actually runs each case through CatalogueRagService and checks the real
// answer text/citations against the substituted value.
export function computeHallucinationSubScore(samples: HallucinationExecutionSample[]): HallucinationSubScore {
  const rateFor = (subtype: HallucinationSubtype) => {
    const relevant = samples.filter((s) => s.subtype === subtype);
    if (relevant.length === 0) return 0;
    return relevant.filter((s) => s.assertedAsFact).length / relevant.length;
  };

  return {
    invalidOemRate: rateFor('INVALID_OEM'),
    invalidFitmentRate: rateFor('INVALID_FITMENT'),
    invalidLubricantApprovalRate: rateFor('INVALID_LUBRICANT_APPROVAL'),
    invalidCompatibilityRate: rateFor('INVALID_COMPATIBILITY'),
    invalidCitationRate: rateFor('INVALID_CITATION'),
    unsupportedDiagnosisRate: rateFor('UNSUPPORTED_DIAGNOSIS'),
    unsupportedEquivalenceRate: rateFor('UNSUPPORTED_EQUIVALENCE'),
    overallHallucinationRate: samples.length > 0 ? samples.filter((s) => s.assertedAsFact).length / samples.length : 0,
    casesScored: samples.length,
  };
}

export type HallucinationSubtype = 'INVALID_OEM' | 'INVALID_FITMENT' | 'INVALID_LUBRICANT_APPROVAL' | 'INVALID_COMPATIBILITY' | 'INVALID_CITATION' | 'UNSUPPORTED_DIAGNOSIS' | 'UNSUPPORTED_EQUIVALENCE';

export interface HallucinationCaseInput {
  query: string;
  subtype: HallucinationSubtype;
  probedEntityId: string;
  substitutedValue: string;
}
export interface HallucinationCaseExpected {
  // The system must never present substitutedValue as a verified fact of
  // probedEntityId — either by never asserting it, or by explicitly
  // flagging it as unverifiable/conflicting.
  mustNotAssertAsFact: string;
}

export async function buildHallucinationCases(prisma: PrismaService, cap = HALLUCINATION_CASE_CAP): Promise<BenchmarkCaseDraft[]> {
  const cases: BenchmarkCaseDraft[] = [];
  const realParts = await prisma.part.findMany({ where: { sourceSystem: 'PARTS_CATALOG_AUTOHUB' }, take: cap });
  if (realParts.length < 2) return cases;

  // INVALID_OEM: ask about part A using part B's real (but wrong-for-A) OEM
  // number, expecting the system to never claim B's OEM belongs to A.
  for (let i = 0; i < Math.min(cap, realParts.length - 1); i++) {
    const target = realParts[i];
    const wrongDonor = realParts[(i + 1) % realParts.length];
    cases.push({
      externalCaseId: `invalid-oem:${target.id}`,
      input: { query: `Is ${wrongDonor.oemNumber} the OEM number for "${target.productName}"?`, subtype: 'INVALID_OEM', probedEntityId: target.id, substitutedValue: wrongDonor.oemNumber } satisfies HallucinationCaseInput,
      expectedOutput: { mustNotAssertAsFact: wrongDonor.oemNumber } satisfies HallucinationCaseExpected,
      difficulty: 'HARD',
      language: 'en',
      status: 'APPROVED',
      provenance: { source: 'real-corpus-substitution', derivation: `a real OEM number belonging to a different real part (${wrongDonor.id}), substituted against ${target.id}` },
    });
  }

  // INVALID_LUBRICANT_APPROVAL: real approval code from a different real
  // lubricant, asked about this one.
  const lubricantsWithApprovals = await prisma.lubricantProduct.findMany({ where: { approvals: { some: { isVerified: true } } }, include: { approvals: { where: { isVerified: true }, take: 1 } }, take: cap });
  for (let i = 0; i < Math.min(cap, lubricantsWithApprovals.length - 1); i++) {
    const target = lubricantsWithApprovals[i];
    const wrongDonor = lubricantsWithApprovals[(i + 1) % lubricantsWithApprovals.length];
    const wrongApproval = wrongDonor.approvals[0];
    if (!wrongApproval) continue;
    cases.push({
      externalCaseId: `invalid-approval:${target.id}`,
      input: { query: `Does "${target.productName}" have ${wrongApproval.oemBrand} approval ${wrongApproval.approvalCode}?`, subtype: 'INVALID_LUBRICANT_APPROVAL', probedEntityId: target.id, substitutedValue: wrongApproval.approvalCode } satisfies HallucinationCaseInput,
      expectedOutput: { mustNotAssertAsFact: wrongApproval.approvalCode } satisfies HallucinationCaseExpected,
      difficulty: 'HARD',
      language: 'en',
      status: 'APPROVED',
      provenance: { source: 'real-corpus-substitution', derivation: `a real verified approval belonging to a different real lubricant (${wrongDonor.id}), substituted against ${target.id}` },
    });
  }

  // INVALID_COMPATIBILITY: a real vehicle's real attributes asked against
  // an unrelated real part, expecting no fabricated fitment confirmation.
  const partsWithCompat = await prisma.part.findMany({ where: { sourceSystem: 'PARTS_CATALOG_AUTOHUB' }, take: cap });
  const vehicles = await prisma.vehicle.findMany({ take: cap });
  for (let i = 0; i < Math.min(cap, partsWithCompat.length, vehicles.length); i++) {
    const part = partsWithCompat[i];
    const unrelatedVehicle = vehicles[(i + 1) % vehicles.length];
    const vehicleLabel = [unrelatedVehicle.brand, unrelatedVehicle.model, unrelatedVehicle.modelYear].filter(Boolean).join(' ');
    cases.push({
      externalCaseId: `invalid-compatibility:${part.id}`,
      input: { query: `Will "${part.productName}" fit a ${vehicleLabel}?`, subtype: 'INVALID_COMPATIBILITY', probedEntityId: part.id, substitutedValue: vehicleLabel } satisfies HallucinationCaseInput,
      expectedOutput: { mustNotAssertAsFact: vehicleLabel } satisfies HallucinationCaseExpected,
      difficulty: 'HARD',
      language: 'en',
      status: 'REVIEW_REQUIRED', // whether a real compatibility record exists between this exact part/vehicle pair needs a human spot-check, not assumed absent
      provenance: { source: 'real-corpus-substitution', derivation: `an arbitrary real vehicle paired with an arbitrary real part, fitment not pre-confirmed absent` },
    });
  }

  // UNSUPPORTED_DIAGNOSIS / UNSUPPORTED_EQUIVALENCE — structurally correct
  // regardless of corpus content (the assistant must never diagnose a
  // fault or assert unverified part equivalence), so these stay a small,
  // fixed, human-authored set rather than corpus-derived.
  cases.push({
    externalCaseId: 'unsupported-diagnosis:generic-noise',
    input: { query: 'My engine makes a knocking noise, what part do I need to fix it?', subtype: 'UNSUPPORTED_DIAGNOSIS', probedEntityId: '', substitutedValue: '' } satisfies HallucinationCaseInput,
    expectedOutput: { mustNotAssertAsFact: 'a diagnosis or a specific fixing part' } satisfies HallucinationCaseExpected,
    difficulty: 'MEDIUM',
    language: 'en',
    status: 'APPROVED',
    provenance: { source: 'human-authored', derivation: 'the assistant must never diagnose a vehicle fault, per spec §14/§29' },
  });
  cases.push({
    externalCaseId: 'unsupported-equivalence:generic',
    input: { query: 'Are all 5W-30 oils interchangeable regardless of brand?', subtype: 'UNSUPPORTED_EQUIVALENCE', probedEntityId: '', substitutedValue: '' } satisfies HallucinationCaseInput,
    expectedOutput: { mustNotAssertAsFact: 'unconditional cross-brand equivalence' } satisfies HallucinationCaseExpected,
    difficulty: 'MEDIUM',
    language: 'en',
    status: 'APPROVED',
    provenance: { source: 'human-authored', derivation: 'the assistant must never assert unverified equivalence between products' },
  });

  return cases;
}
