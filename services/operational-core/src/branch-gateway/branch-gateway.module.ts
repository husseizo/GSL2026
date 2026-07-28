import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { BranchGatewayController } from './branch-gateway.controller';
import { BranchGatewayService } from './branch-gateway.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [BranchGatewayController],
  providers: [BranchGatewayService],
  exports: [BranchGatewayService],
})
export class BranchGatewayModule {}
