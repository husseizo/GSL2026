import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TimelineEntry {
  occurredAt: Date;
  eventType: string;
  description: string;
  jobId: string | null;
  metadata?: unknown;
}

// The permanent, chronological record of everything that happened to a
// vehicle — built by merging the append-only JobTimeline entries of every
// job the vehicle has ever had, plus its reception arrivals. Not a separate
// mutable table: the underlying JobTimeline/VehicleReception rows are the
// source of truth, this just orders them. See docs/architecture/vehicle-history.md.
@Injectable()
export class VehicleTimelineService {
  constructor(private readonly prisma: PrismaService) {}

  async getTimeline(vehicleId: string): Promise<TimelineEntry[]> {
    const [receptions, timelineEvents] = await Promise.all([
      this.prisma.vehicleReception.findMany({ where: { vehicleId } }),
      this.prisma.jobTimeline.findMany({ where: { job: { vehicleId } }, include: { job: true } }),
    ]);

    const entries: TimelineEntry[] = [
      ...receptions.map((r) => ({
        occurredAt: r.arrivalAt,
        eventType: 'VEHICLE_RECEIVED',
        description: `Vehicle received at mileage ${r.mileage}`,
        jobId: null,
      })),
      ...timelineEvents.map((e) => ({
        occurredAt: e.occurredAt,
        eventType: e.eventType,
        description: e.description,
        jobId: e.jobId,
        metadata: e.metadata,
      })),
    ];

    return entries.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  }
}
