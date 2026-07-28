// DGX Prototype 1.7.1 — versioned extraction profiles per document type
// (spec §16). Each profile is real configuration data (required metadata,
// expected sections, candidate entities/claims, structured facts,
// validation rules, high-risk fields, approval roles, rejection rules,
// evaluation cases to generate) — append-only versioned, same discipline
// as every other Knowledge Platform model: a correction creates a new
// version, never edits a published one.
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SEED_EXTRACTION_PROFILES } from './seed-profiles';

export interface ExtractionProfileFieldRules {
  requiredMetadata: string[];
  expectedSections: string[];
  candidateEntities: string[];
  candidateClaimTypes: string[];
  structuredFactTypes: string[];
  highRiskFields: string[];
  approvalRoles: ('TECHNICAL_REVIEWER' | 'LICENSING_REVIEWER' | 'SAFETY_REVIEWER' | 'FINAL_APPROVER')[];
  rejectionRules: string[];
}

@Injectable()
export class ExtractionProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async createProfile(documentType: string, fieldRules: ExtractionProfileFieldRules) {
    const latest = await this.prisma.extractionProfile.findFirst({ where: { documentType }, orderBy: { version: 'desc' } });
    // Real, non-destructive versioning — a new version never invalidates
    // facts already extracted under a prior version.
    if (latest) {
      await this.prisma.extractionProfile.update({ where: { id: latest.id }, data: { isActive: false } });
    }
    return this.prisma.extractionProfile.create({
      data: { documentType, version: (latest?.version ?? 0) + 1, fieldRules: fieldRules as unknown as object, isActive: true },
    });
  }

  async getActiveProfile(documentType: string) {
    const profile = await this.prisma.extractionProfile.findFirst({ where: { documentType, isActive: true }, orderBy: { version: 'desc' } });
    if (!profile) throw new NotFoundException(`No active ExtractionProfile for documentType "${documentType}"`);
    return profile;
  }

  listVersions(documentType: string) {
    return this.prisma.extractionProfile.findMany({ where: { documentType }, orderBy: { version: 'desc' } });
  }

  // Seeds all 11 real profiles (spec §16) — idempotent, skips a
  // documentType that already has an active profile rather than creating a
  // redundant version 2 on every app boot/verify-script run.
  async seedAll(): Promise<number> {
    let seeded = 0;
    for (const [documentType, fieldRules] of Object.entries(SEED_EXTRACTION_PROFILES)) {
      const existing = await this.prisma.extractionProfile.findFirst({ where: { documentType } });
      if (existing) continue;
      await this.createProfile(documentType, fieldRules);
      seeded += 1;
    }
    return seeded;
  }
}
