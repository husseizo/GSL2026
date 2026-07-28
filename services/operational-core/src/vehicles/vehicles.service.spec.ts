import { NotFoundException } from '@nestjs/common';
import { DecodeConfidence } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VehiclesService } from './vehicles.service';

describe('VehiclesService', () => {
  let service: VehiclesService;
  let prisma: {
    vehicle: { findUnique: jest.Mock; update: jest.Mock };
    vehicleAttributeHistory: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      vehicle: { findUnique: jest.fn(), update: jest.fn() },
      vehicleAttributeHistory: { create: jest.fn() },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };
    service = new VehiclesService(prisma as unknown as PrismaService);
  });

  it('throws NotFoundException when correcting a vehicle that does not exist', async () => {
    prisma.vehicle.findUnique.mockResolvedValue(null);

    await expect(
      service.correctAttribute('missing-id', { field: 'brand', newValue: 'BMW' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('writes an append-only history row and updates the current value on correction', async () => {
    prisma.vehicle.findUnique.mockResolvedValue({
      id: 'v1',
      brand: 'Landrover', // deliberately wrong casing, being corrected
      decodeConfidence: { brand: 'LOW' },
    });
    prisma.vehicle.update.mockResolvedValue({ id: 'v1', brand: 'Land Rover' });

    const result = await service.correctAttribute('v1', {
      field: 'brand',
      newValue: 'Land Rover',
      reason: 'Fixed casing from VIN decode',
      confidence: DecodeConfidence.HIGH,
      changedById: 'user-1',
    });

    expect(prisma.vehicleAttributeHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vehicleId: 'v1',
        field: 'brand',
        oldValue: 'Landrover',
        newValue: 'Land Rover',
        confidence: DecodeConfidence.HIGH,
        changedById: 'user-1',
      }),
    });
    expect(prisma.vehicle.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: {
        brand: 'Land Rover',
        decodeConfidence: { brand: DecodeConfidence.HIGH },
      },
    });
    expect(result).toEqual({ id: 'v1', brand: 'Land Rover' });
  });

  it('coerces integer fields (e.g. modelYear) before writing', async () => {
    prisma.vehicle.findUnique.mockResolvedValue({
      id: 'v1',
      modelYear: 2019,
      decodeConfidence: {},
    });
    prisma.vehicle.update.mockResolvedValue({ id: 'v1', modelYear: 2020 });

    await service.correctAttribute('v1', { field: 'modelYear', newValue: '2020' });

    expect(prisma.vehicle.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: {
        modelYear: 2020,
        decodeConfidence: { modelYear: DecodeConfidence.UNVERIFIED },
      },
    });
  });
});
