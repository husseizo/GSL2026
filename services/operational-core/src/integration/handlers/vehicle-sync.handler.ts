import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitySyncHandler, ValidationResult } from '../entity-sync-handler.interface';
import { stableChecksum } from '../checksum';

// Shape assumed for a nightly export from the legacy sales/ERP vehicle table.
// This is the one file that changes when the real schema is known — nothing
// else in the sync pipeline depends on it.
export interface LegacyVehicleRaw {
  vin?: string;
  reg_no?: string;
  make: string;
  model: string;
  variant?: string;
  year?: number;
  engine_code?: string;
  fuel_type?: string;
}

export interface NormalizedVehicle {
  vin?: string;
  registrationNumber?: string;
  brand: string;
  model: string;
  variant?: string;
  modelYear?: number;
  engineCode?: string;
  fuelType?: string;
}

@Injectable()
export class VehicleSyncHandler implements EntitySyncHandler<LegacyVehicleRaw, NormalizedVehicle> {
  readonly entityType = 'VEHICLE' as const;

  constructor(private readonly prisma: PrismaService) {}

  validate(raw: LegacyVehicleRaw): ValidationResult {
    if (!raw.make?.trim()) return { valid: false, error: 'make is required' };
    if (!raw.model?.trim()) return { valid: false, error: 'model is required' };
    return { valid: true };
  }

  normalize(raw: LegacyVehicleRaw): NormalizedVehicle {
    return {
      vin: raw.vin?.trim().toUpperCase() || undefined,
      registrationNumber: raw.reg_no?.trim() || undefined,
      brand: raw.make.trim(),
      model: raw.model.trim(),
      variant: raw.variant?.trim() || undefined,
      modelYear: raw.year,
      engineCode: raw.engine_code?.trim() || undefined,
      fuelType: raw.fuel_type?.trim() || undefined,
    };
  }

  checksum(normalized: NormalizedVehicle): string {
    return stableChecksum(normalized);
  }

  async getExistingChecksum(sourceSystem: string, sourceRecordId: string): Promise<string | null> {
    const existing = await this.prisma.vehicle.findUnique({
      where: { sourceSystem_sourceRecordId: { sourceSystem, sourceRecordId } },
    });
    return existing?.checksum ?? null;
  }

  async upsert(params: {
    sourceSystem: string;
    sourceRecordId: string;
    recordVersion?: string;
    checksum: string;
    normalized: NormalizedVehicle;
  }): Promise<void> {
    const { sourceSystem, sourceRecordId, recordVersion, checksum, normalized } = params;
    await this.prisma.vehicle.upsert({
      where: { sourceSystem_sourceRecordId: { sourceSystem, sourceRecordId } },
      create: {
        ...normalized,
        sourceSystem,
        sourceRecordId,
        externalId: normalized.vin,
        syncedAt: new Date(),
        recordVersion,
        checksum,
      },
      update: {
        ...normalized,
        externalId: normalized.vin,
        syncedAt: new Date(),
        recordVersion,
        checksum,
      },
    });
  }
}
