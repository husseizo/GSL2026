import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { AuthTokenService } from './auth-token.service';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { JwtAuthContextGuard } from './jwt-auth-context.guard';
import { JwtKeyService } from './jwt-key.service';

// JwtAuthContextGuard is registered as a global guard (APP_GUARD) — it runs
// on every request before any route-specific guard, which is what lets it
// enrich getRequestActor() without a single existing controller changing
// its @UseGuards(...) list. See docs/architecture/identity-platform.md.
@Module({
  imports: [JwtModule.register({})],
  controllers: [IdentityController, ApiKeysController],
  providers: [
    IdentityService,
    AuthTokenService,
    JwtKeyService,
    ApiKeysService,
    { provide: APP_GUARD, useClass: JwtAuthContextGuard },
  ],
  exports: [IdentityService, AuthTokenService, JwtKeyService, ApiKeysService],
})
export class IdentityModule {}
