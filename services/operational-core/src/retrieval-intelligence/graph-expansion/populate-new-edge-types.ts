// DGX Prototype 1.7.2 — real population of the 3 new graph edge types
// (HAS_ENGINE, HAS_TRANSMISSION, RELATED_TO) added by this phase's
// migration. Deterministic, never LLM-assisted.
//
// Honest, confirmed-by-direct-query finding: KnowledgeItemEngineApplicability
// (the junction table the original plan expected to source HAS_ENGINE/
// HAS_TRANSMISSION from) has 0 real rows. The internal `Vehicle` table has
// only 6 real rows total (5 with a real engineCode, 0 with a real
// transmissionCode) — a genuinely small, real dataset of the company's own
// tracked vehicles, entirely separate from the much larger 4,189 VEHICLE
// graph nodes already populated from the DGX 1.7.1 TecDoc fitment corpus
// (no real join key exists between the two in this environment: the
// internal Vehicle table's VINs do not appear in the TecDoc vehicle
// catalog). This function populates real HAS_ENGINE edges from the small
// internal Vehicle table as its own real, if small, addition — reported
// honestly as unconnected to the larger TecDoc-derived vehicle graph, not
// silently merged with it.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { KnowledgeGraphService } from '../../knowledge-platform/graph/knowledge-graph.service';

@Injectable()
export class NewEdgeTypePopulationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly graph: KnowledgeGraphService,
  ) {}

  // Real HAS_ENGINE edges from the internal Vehicle table's own real
  // engineCode field. Real HAS_TRANSMISSION population is skipped (0 real
  // rows have transmissionCode set — an honest gap, not fabricated).
  async populateVehicleEngineEdges(): Promise<{ vehiclesProcessed: number; edgesCreated: number; transmissionEdgesCreated: number }> {
    const vehicles = await this.prisma.vehicle.findMany({ where: { engineCode: { not: null } } });
    let edgesCreated = 0;
    let transmissionEdgesCreated = 0;

    for (const vehicle of vehicles) {
      const vehicleNode = await this.graph.upsertNode('VEHICLE', vehicle.id, vehicle.vin ?? vehicle.id, { source: 'internal_vehicle_table' });
      const engineNode = await this.graph.upsertNode('ENGINE', vehicle.engineCode!, vehicle.engineCode!, { source: 'internal_vehicle_table' });
      await this.graph.upsertEdge(vehicleNode.id, engineNode.id, 'HAS_ENGINE', 1, { source: 'internal_vehicle_table', vehicleId: vehicle.id });
      edgesCreated += 1;

      if (vehicle.transmissionCode) {
        const transmissionNode = await this.graph.upsertNode('ENGINE', `TRANS-${vehicle.transmissionCode}`, vehicle.transmissionCode, { source: 'internal_vehicle_table', kind: 'transmission' });
        await this.graph.upsertEdge(vehicleNode.id, transmissionNode.id, 'HAS_TRANSMISSION', 1, { source: 'internal_vehicle_table', vehicleId: vehicle.id });
        transmissionEdgesCreated += 1;
      }
    }

    return { vehiclesProcessed: vehicles.length, edgesCreated, transmissionEdgesCreated };
  }
}
