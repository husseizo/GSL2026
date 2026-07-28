import { Injectable, NotFoundException } from '@nestjs/common';
import { DataQualitySeverity } from '@prisma/client';
import { DataQualityService } from '../common/data-quality/data-quality.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReceptionDto } from './dto/create-reception.dto';

@Injectable()
export class ReceptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataQuality: DataQualityService,
  ) {}

  async create(dto: CreateReceptionDto) {
    await this.checkMileage(dto.vehicleId, dto.mileage);

    return this.prisma.vehicleReception.create({
      data: {
        vehicleId: dto.vehicleId,
        customerId: dto.customerId,
        branchId: dto.branchId,
        receivedById: dto.receivedById,
        driverName: dto.driverName,
        mileage: dto.mileage,
        fuelLevel: dto.fuelLevel,
        batteryVoltage: dto.batteryVoltage,
        expectedCompletionAt: dto.expectedCompletionAt ? new Date(dto.expectedCompletionAt) : undefined,
        receptionNotes: dto.receptionNotes,
        conditions: dto.conditions ? { create: dto.conditions } : undefined,
        complaints: dto.complaints
          ? { create: dto.complaints.map((c) => ({ ...c, vehicleId: dto.vehicleId })) }
          : undefined,
        accessories: dto.accessories ? { create: dto.accessories } : undefined,
      },
      include: { conditions: true, complaints: true, accessories: true },
    });
  }

  async findById(id: string) {
    const reception = await this.prisma.vehicleReception.findUnique({
      where: { id },
      include: { conditions: true, complaints: true, accessories: true, photos: true, jobs: true },
    });
    if (!reception) throw new NotFoundException(`Reception ${id} not found`);
    return reception;
  }

  list(filter: { vehicleId?: string; branchId?: string }) {
    return this.prisma.vehicleReception.findMany({
      where: filter,
      orderBy: { arrivalAt: 'desc' },
    });
  }

  addPhoto(receptionId: string, url: string, caption?: string) {
    return this.prisma.vehiclePhoto.create({ data: { receptionId, url, caption } });
  }

  returnAccessory(accessoryId: string) {
    return this.prisma.vehicleAccessory.update({ where: { id: accessoryId }, data: { returnedAt: new Date() } });
  }

  // Data quality §20: "impossible mileage decrease" — compare against the
  // highest mileage ever recorded for this vehicle (receptions + job check-ins).
  private async checkMileage(vehicleId: string, mileage: number) {
    const [lastReception, lastJob] = await Promise.all([
      this.prisma.vehicleReception.findFirst({ where: { vehicleId }, orderBy: { mileage: 'desc' } }),
      this.prisma.garageJob.findFirst({
        where: { vehicleId, mileageAtCheckIn: { not: null } },
        orderBy: { mileageAtCheckIn: 'desc' },
      }),
    ]);

    const priorMax = Math.max(lastReception?.mileage ?? 0, lastJob?.mileageAtCheckIn ?? 0);
    if (priorMax > 0 && mileage < priorMax) {
      await this.dataQuality.record({
        checkName: 'impossible_mileage_decrease',
        severity: DataQualitySeverity.MANUAL_REVIEW,
        entityType: 'VehicleReception',
        message: `New reception mileage ${mileage} is lower than a previously recorded mileage of ${priorMax} for vehicle ${vehicleId}`,
        context: { vehicleId, newMileage: mileage, priorMax },
      });
    }
  }
}
