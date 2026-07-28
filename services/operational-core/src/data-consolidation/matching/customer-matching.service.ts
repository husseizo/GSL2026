import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { isGenericCustomerCode, normalizeCompanyName, normalizePhone, normalizeTaxNumber } from '../normalize';

export interface CustomerMatchCandidateInput {
  sourceSystem: string;
  sourceRecordId: string;
  rawName: string | null;
  rawPhone: string | null;
  rawTaxNumber: string | null;
  rawEmail: string | null;
}

export interface CustomerMatchOutcome {
  matchLevel: 'EXACT' | 'HIGH_CONFIDENCE' | 'POSSIBLE_MATCH' | 'NO_MATCH' | 'CONFLICT';
  candidateCustomerId: string | null;
  matchSignals: Record<string, unknown>;
  confidenceScore: number;
}

// Implements the match-level rules from
// docs/data-consolidation/customer-consolidation.md — never auto-merges
// anything below HIGH_CONFIDENCE; POSSIBLE_MATCH always goes to manual
// review, per the phase's explicit "never auto-merge POSSIBLE_MATCH" rule.
@Injectable()
export class CustomerMatchingService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluateMatch(input: CustomerMatchCandidateInput): Promise<CustomerMatchOutcome> {
    // Existing direct link for this exact source record — not a "new match"
    // decision, the caller should already be routing this to an update, not
    // through this evaluator. Included defensively so a re-entrant call is
    // still correct rather than silently duplicating a real customer.
    const existingRef = await this.prisma.customerExternalReference.findUnique({
      where: { sourceSystem_sourceRecordId: { sourceSystem: input.sourceSystem, sourceRecordId: input.sourceRecordId } },
    });
    if (existingRef) {
      return { matchLevel: 'EXACT', candidateCustomerId: existingRef.customerId, matchSignals: { existingExternalReference: true }, confidenceScore: 1 };
    }

    if (isGenericCustomerCode(input.sourceRecordId) || isGenericCustomerCode(input.rawName)) {
      return { matchLevel: 'NO_MATCH', candidateCustomerId: null, matchSignals: { genericCode: true, reason: 'walk-in/generic code, never merged with a real party' }, confidenceScore: 0 };
    }

    const taxNumber = normalizeTaxNumber(input.rawTaxNumber);
    const phone = normalizePhone(input.rawPhone);
    const name = normalizeCompanyName(input.rawName);
    const email = input.rawEmail?.trim().toLowerCase() || null;

    // EXACT: same tax number, or same normalized phone against an existing
    // customer's stored phone.
    if (taxNumber) {
      const byTax = await this.prisma.customer.findFirst({ where: { taxNumber } });
      if (byTax) return { matchLevel: 'EXACT', candidateCustomerId: byTax.id, matchSignals: { taxNumber }, confidenceScore: 1 };
    }

    let phoneMatch: { id: string; legalName: string } | null = null;
    if (phone) {
      const candidates = await this.prisma.customer.findMany({ where: { phone: { not: null } }, select: { id: true, legalName: true, phone: true } });
      const found = candidates.find((c) => normalizePhone(c.phone) === phone);
      if (found) phoneMatch = { id: found.id, legalName: found.legalName };
    }

    if (phoneMatch && name) {
      const phoneMatchNameNormalized = normalizeCompanyName(phoneMatch.legalName);
      if (phoneMatchNameNormalized === name) {
        return { matchLevel: 'EXACT', candidateCustomerId: phoneMatch.id, matchSignals: { phone, name }, confidenceScore: 0.98 };
      }
      // Same phone, different name — a real conflict worth a human's eyes
      // rather than a silent guess either way.
      return { matchLevel: 'CONFLICT', candidateCustomerId: phoneMatch.id, matchSignals: { phone, sourceName: name, existingName: phoneMatchNameNormalized }, confidenceScore: 0.5 };
    }

    // HIGH_CONFIDENCE: same email plus a similar (not necessarily identical) name.
    if (email && name) {
      const byEmail = await this.prisma.customer.findFirst({ where: { email } });
      if (byEmail) {
        const existingName = normalizeCompanyName(byEmail.legalName);
        const similar = existingName === name || (existingName?.includes(name) ?? false) || (name.includes(existingName ?? '__none__') ?? false);
        if (similar) return { matchLevel: 'HIGH_CONFIDENCE', candidateCustomerId: byEmail.id, matchSignals: { email, name }, confidenceScore: 0.85 };
      }
    }

    // POSSIBLE_MATCH: name similarity alone — never auto-merged.
    if (name) {
      const candidates = await this.prisma.customer.findMany({ select: { id: true, legalName: true } });
      const found = candidates.find((c) => normalizeCompanyName(c.legalName) === name);
      if (found) return { matchLevel: 'POSSIBLE_MATCH', candidateCustomerId: found.id, matchSignals: { name }, confidenceScore: 0.4 };
    }

    return { matchLevel: 'NO_MATCH', candidateCustomerId: null, matchSignals: {}, confidenceScore: 0 };
  }
}
