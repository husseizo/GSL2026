import { Injectable, NotFoundException } from '@nestjs/common';
import { DecodeConfidence, Vehicle } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { CorrectVehicleAttributeDto } from './dto/correct-vehicle-attribute.dto';

const INT_FIELDS = new Set(['modelYear']);

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateVehicleDto): Promise<Vehicle> {
    return this.prisma.vehicle.create({ data: dto });
  }

  findById(id: string): Promise<Vehicle | null> {
    return this.prisma.vehicle.findUnique({
      where: { id },
      include: { attributeHistory: { orderBy: { changedAt: 'desc' } } },
    });
  }

  findByVin(vin: string): Promise<Vehicle | null> {
    return this.prisma.vehicle.findUnique({ where: { vin } });
  }

  list(filter: { brand?: string; model?: string }): Promise<Vehicle[]> {
    return this.prisma.vehicle.findMany({
      where: {
        brand: filter.brand ? { equals: filter.brand, mode: 'insensitive' } : undefined,
        model: filter.model ? { equals: filter.model, mode: 'insensitive' } : undefined,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Every correction is append-only history + an update to the current value —
  // never a silent overwrite. See docs/architecture/01-data-model.md §2.
  async correctAttribute(vehicleId: string, dto: CorrectVehicleAttributeDto): Promise<Vehicle> {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${vehicleId} not found`);
    }

    const oldValue = vehicle[dto.field as keyof Vehicle];
    const coercedNewValue: string | number = INT_FIELDS.has(dto.field)
      ? parseInt(dto.newValue, 10)
      : dto.newValue;

    const existingConfidence = (vehicle.decodeConfidence as Record<string, DecodeConfidence>) ?? {};

    return this.prisma.$transaction(async (tx) => {
      await tx.vehicleAttributeHistory.create({
        data: {
          vehicleId,
          field: dto.field,
          oldValue: oldValue === null || oldValue === undefined ? null : String(oldValue),
          newValue: dto.newValue,
          reason: dto.reason,
          confidence: dto.confidence ?? DecodeConfidence.UNVERIFIED,
          changedById: dto.changedById,
        },
      });

      return tx.vehicle.update({
        where: { id: vehicleId },
        data: {
          [dto.field]: coercedNewValue,
          decodeConfidence: {
            ...existingConfidence,
            [dto.field]: dto.confidence ?? DecodeConfidence.UNVERIFIED,
          },
        },
      });
    });
  }
}
