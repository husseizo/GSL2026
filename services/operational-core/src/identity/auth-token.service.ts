import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { JwtKeyService } from './jwt-key.service';

export interface AccessTokenClaims {
  sub: string; // userId
  email: string;
  role: Role;
  branchId?: string;
  sessionId: string;
}

const ACCESS_TOKEN_TTL = '15m';

@Injectable()
export class AuthTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly keys: JwtKeyService,
  ) {}

  signAccessToken(claims: AccessTokenClaims): string {
    return this.jwt.sign(claims, {
      secret: this.keys.getCurrentSecret(),
      keyid: this.keys.getCurrentKid(),
      expiresIn: ACCESS_TOKEN_TTL,
    });
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    const decoded = this.jwt.decode(token, { complete: true }) as { header?: { kid?: string } } | null;
    const kid = decoded?.header?.kid;
    const secret = kid ? this.keys.getSecretForKid(kid) : this.keys.getCurrentSecret();
    if (!secret) throw new UnauthorizedException('Token signed with an unknown or retired key');

    try {
      return this.jwt.verify<AccessTokenClaims>(token, { secret });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
