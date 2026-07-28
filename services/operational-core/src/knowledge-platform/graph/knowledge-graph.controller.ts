import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { KnowledgeGraphEdgeType, KnowledgeGraphNodeType } from '@prisma/client';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { RequirePermissions } from '../../common/permissions/permissions.decorator';
import { KnowledgeGraphService } from './knowledge-graph.service';

@Controller('knowledge/graph')
@UseGuards(PermissionsGuard)
export class KnowledgeGraphController {
  constructor(private readonly graph: KnowledgeGraphService) {}

  @Post('query')
  @RequirePermissions('knowledgeGraph.read')
  query(@Body() body: { startNodeType: KnowledgeGraphNodeType; startRefId: string; edgeTypes: KnowledgeGraphEdgeType[]; maxDepth?: number }) {
    return this.graph.traverse(body.startNodeType, body.startRefId, body.edgeTypes, body.maxDepth);
  }
}
