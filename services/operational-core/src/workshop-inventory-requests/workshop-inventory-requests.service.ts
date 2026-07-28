import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkshopRequestStatus } from '@prisma/client';
import { PurchaseRecommendationsService } from '../purchase-recommendations/purchase-recommendations.service';
import { TransferRecommendationsService } from '../transfer-recommendations/transfer-recommendations.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkshopInventoryRequestDto } from './dto/create-request.dto';

// "Connect directly to Purchase Recommendation engine" — this service never
// computes its own reorder logic; it re-runs Phase 2's existing
// PurchaseRecommendationsService/TransferRecommendationsService and links to
// whatever they produce for this item+warehouse. See
// docs/architecture/garage-architecture.md §11.
@Injectable()
export class WorkshopInventoryRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly purchaseRecs: PurchaseRecommendationsService,
    private readonly transferRecs: TransferRecommendationsService,
  ) {}

  create(dto: CreateWorkshopInventoryRequestDto) {
    return this.prisma.workshopInventoryRequest.create({ data: dto });
  }

  list(filter: { status?: WorkshopRequestStatus; jobId?: string }) {
    return this.prisma.workshopInventoryRequest.findMany({ where: filter, orderBy: { requestedAt: 'desc' } });
  }

  async linkToRecommendations(requestId: string) {
    const request = await this.prisma.workshopInventoryRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException(`Workshop inventory request ${requestId} not found`);

    await Promise.all([this.purchaseRecs.generate(), this.transferRecs.generate()]);

    const [purchaseRec, transferRec] = await Promise.all([
      this.prisma.purchaseRecommendation.findFirst({
        where: { partId: request.partId, lubricantProductId: request.lubricantProductId, warehouseId: request.warehouseId, status: 'PENDING' },
        orderBy: { generatedAt: 'desc' },
      }),
      this.prisma.transferRecommendation.findFirst({
        where: { partId: request.partId, lubricantProductId: request.lubricantProductId, destinationWarehouseId: request.warehouseId, status: 'PENDING' },
        orderBy: { generatedAt: 'desc' },
      }),
    ]);

    const linkedTransfer = !!transferRec;
    const status = linkedTransfer
      ? WorkshopRequestStatus.LINKED_TO_TRANSFER
      : purchaseRec
        ? WorkshopRequestStatus.LINKED_TO_PURCHASE
        : request.status;

    return this.prisma.workshopInventoryRequest.update({
      where: { id: requestId },
      data: {
        status,
        transferRecommendationId: transferRec?.id,
        purchaseRecommendationId: purchaseRec?.id,
      },
    });
  }

  async markFulfilled(requestId: string) {
    return this.prisma.workshopInventoryRequest.update({
      where: { id: requestId },
      data: { status: WorkshopRequestStatus.FULFILLED, resolvedAt: new Date() },
    });
  }
}
