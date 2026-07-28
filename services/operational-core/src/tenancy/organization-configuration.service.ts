import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UpsertOrganizationConfigurationDto {
  timezone?: string;
  currency?: string;
  locale?: string;
  brandName?: string;
  logoUrl?: string;
  featureFlags?: Record<string, boolean>;
}

// Per-organization timezone/currency/locale/branding/feature-flags. One row
// per Organization — real defaults (Africa/Dar_es_Salaam, TZS, en) match
// what Phase 2's Branch model already defaulted to per-branch, now
// promoted to an organization-level, centrally-configurable setting rather
// than a hardcoded default scattered across models. See
// docs/architecture/tenant-readiness.md.
@Injectable()
export class OrganizationConfigurationService {
  constructor(private readonly prisma: PrismaService) {}

  async get(organizationId: string) {
    const config = await this.prisma.organizationConfiguration.findUnique({ where: { organizationId } });
    if (!config) return this.getDefaults(organizationId);
    return config;
  }

  async upsert(organizationId: string, dto: UpsertOrganizationConfigurationDto) {
    return this.prisma.organizationConfiguration.upsert({
      where: { organizationId },
      create: { organizationId, ...dto, featureFlags: dto.featureFlags as object | undefined },
      update: { ...dto, featureFlags: dto.featureFlags as object | undefined },
    });
  }

  async isFeatureEnabled(organizationId: string, flag: string): Promise<boolean> {
    const config = await this.get(organizationId);
    const flags = (config.featureFlags as Record<string, boolean> | null) ?? {};
    return flags[flag] ?? false;
  }

  private getDefaults(organizationId: string) {
    return {
      id: null,
      organizationId,
      timezone: 'Africa/Dar_es_Salaam',
      currency: 'TZS',
      locale: 'en',
      brandName: null,
      logoUrl: null,
      featureFlags: {},
      createdAt: null,
      updatedAt: null,
    };
  }

  async getOrThrow(organizationId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException(`Organization ${organizationId} not found`);
    return this.get(organizationId);
  }
}
