import { Module } from '@nestjs/common';
import { ScopeGuard } from './scope.guard';

@Module({
  providers: [ScopeGuard],
  exports: [ScopeGuard],
})
export class AuthorizationModule {}
