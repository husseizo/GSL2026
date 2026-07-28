import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { getRequestActor } from '../common/permissions/request-actor';
import { RegisterDto } from './dto/auth.dto';
import { IdentityService } from './identity.service';

// No PermissionsGuard on /auth/* — these are the endpoints a caller uses
// *to obtain* credentials in the first place (login, refresh, password
// reset), or act on their own identity once authenticated. Endpoints that
// need to know "who is calling" (sessions, MFA, logout) read the actor
// JwtAuthContextGuard already resolved, and reject if no verified actor is
// present — see docs/architecture/identity-platform.md.
@ApiTags('auth')
@Controller('auth')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.identity.register(dto);
  }

  @Post('login')
  login(@Body() body: { email: string; password: string; mfaToken?: string; deviceFingerprint?: string; deviceName?: string }, @Req() req: Request) {
    return this.identity.login({
      ...body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('refresh')
  refresh(@Body() body: { refreshToken: string }, @Req() req: Request) {
    return this.identity.refresh({ refreshToken: body.refreshToken, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Post('logout')
  logout(@Req() req: Request) {
    const actor = this.requireVerifiedActor(req);
    return this.identity.logout(actor.sessionId!);
  }

  @Get('sessions')
  listSessions(@Req() req: Request) {
    const actor = this.requireVerifiedActor(req);
    return this.identity.listSessions(actor.userId!);
  }

  @Delete('sessions/:id')
  revokeSession(@Param('id') id: string) {
    return this.identity.revokeSession(id);
  }

  @Get('login-history')
  loginHistory(@Req() req: Request) {
    const actor = this.requireVerifiedActor(req);
    return this.identity.listLoginHistory(actor.userId!);
  }

  @Post('mfa/enroll')
  enrollMfa(@Req() req: Request) {
    const actor = this.requireVerifiedActor(req);
    return this.identity.enrollMfa(actor.userId!);
  }

  @Post('mfa/confirm')
  confirmMfa(@Body() body: { token: string }, @Req() req: Request) {
    const actor = this.requireVerifiedActor(req);
    return this.identity.confirmMfa(actor.userId!, body.token);
  }

  @Post('mfa/disable')
  disableMfa(@Req() req: Request) {
    const actor = this.requireVerifiedActor(req);
    return this.identity.disableMfa(actor.userId!);
  }

  @Post('password/forgot')
  async requestPasswordReset(@Body() body: { email: string }) {
    await this.identity.requestPasswordReset(body.email);
    // Always the same response regardless of whether the email exists —
    // otherwise this endpoint becomes an account-enumeration oracle.
    return { message: 'If an account with that email exists, a password reset link has been sent.' };
  }

  @Post('password/reset')
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    await this.identity.resetPassword(body.token, body.newPassword);
    return { message: 'Password has been reset.' };
  }

  @Post('email/verify/request')
  async requestEmailVerification(@Req() req: Request) {
    const actor = this.requireVerifiedActor(req);
    // The raw token is intentionally discarded here, not returned — see
    // IdentityService.requestEmailVerification()'s comment. Returning it
    // directly (the previous behavior) let a caller self-verify without
    // ever proving control of the mailbox, defeating the point of email
    // verification. See docs/ai-tuning/security-hotfix.md.
    await this.identity.requestEmailVerification(actor.userId!);
    return { message: 'A verification email has been sent.' };
  }

  @Post('email/verify/confirm')
  async verifyEmail(@Body() body: { token: string }) {
    await this.identity.verifyEmail(body.token);
    return { message: 'Email verified.' };
  }

  @Get('users')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('identity.manage')
  listUsers() {
    return this.identity.listUsers();
  }

  @Patch('users/:id/active')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('identity.manage')
  setUserActive(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.identity.setUserActive(id, body.isActive);
  }

  private requireVerifiedActor(req: Request) {
    const actor = getRequestActor(req);
    if (!actor.userId || actor.authMethod !== 'jwt') {
      throw new UnauthorizedException('A valid Bearer access token is required for this endpoint');
    }
    return actor;
  }
}
