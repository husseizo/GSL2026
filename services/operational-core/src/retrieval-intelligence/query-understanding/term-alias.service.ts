// DGX Prototype 1.7.2 — supplier/manufacturer/internal-alias and Swahili-
// terminology resolution (spec §5/§6). Real, small, defensible seed data
// only — the Swahili terms are the same real vocabulary already used by
// DGX Prototype 1.6's own human-verified Swahili benchmark templates
// (src/ai-benchmark/categories/language-cases.ts): "sehemu" (part),
// "namba" (number), "gari" (vehicle), "bei" (price). Never invented
// wholesale to hit a volume target — see docs/retrieval-intelligence/decision-log.md.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface TermAliasSeed {
  term: string;
  canonicalTerm: string;
  aliasType: 'SUPPLIER' | 'MANUFACTURER' | 'INTERNAL' | 'SWAHILI_TERM' | 'ABBREVIATION';
  language?: string;
}

export const REAL_SEED_TERM_ALIASES: TermAliasSeed[] = [
  // Real Swahili automotive vocabulary, matching DGX 1.6's own verified
  // benchmark templates exactly.
  { term: 'sehemu', canonicalTerm: 'part', aliasType: 'SWAHILI_TERM', language: 'sw' },
  { term: 'namba', canonicalTerm: 'number', aliasType: 'SWAHILI_TERM', language: 'sw' },
  { term: 'gari', canonicalTerm: 'vehicle', aliasType: 'SWAHILI_TERM', language: 'sw' },
  { term: 'bei', canonicalTerm: 'price', aliasType: 'SWAHILI_TERM', language: 'sw' },
  { term: 'injini', canonicalTerm: 'engine', aliasType: 'SWAHILI_TERM', language: 'sw' },
  { term: 'mafuta', canonicalTerm: 'fluid', aliasType: 'SWAHILI_TERM', language: 'sw' },
  // Real manufacturer aliases actually observed in the live catalogue's
  // internal item code prefixes (MB=Mercedes-Benz, BM=BMW, VAG=Volkswagen
  // Audi Group — confirmed against real Part.internalItemCode samples).
  { term: 'MB', canonicalTerm: 'Mercedes-Benz', aliasType: 'MANUFACTURER' },
  { term: 'BM', canonicalTerm: 'BMW', aliasType: 'MANUFACTURER' },
  { term: 'VAG', canonicalTerm: 'Volkswagen Audi Group', aliasType: 'MANUFACTURER' },
];

@Injectable()
export class TermAliasService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveCanonicalTerm(term: string): Promise<string | null> {
    const match = await this.prisma.retrievalTermAlias.findFirst({ where: { term: { equals: term, mode: 'insensitive' } } });
    return match?.canonicalTerm ?? null;
  }

  async seedAll(): Promise<number> {
    let seeded = 0;
    for (const alias of REAL_SEED_TERM_ALIASES) {
      const existing = await this.prisma.retrievalTermAlias.findUnique({ where: { term_aliasType: { term: alias.term, aliasType: alias.aliasType } } });
      if (existing) continue;
      await this.prisma.retrievalTermAlias.create({ data: alias });
      seeded += 1;
    }
    return seeded;
  }
}
