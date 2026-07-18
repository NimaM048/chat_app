import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload.sub || !payload.sid) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const session = await this.prisma.refreshToken.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, lastActiveAt: true },
    });

    if (!session) {
      throw new UnauthorizedException('Session revoked or expired');
    }

    const staleMs = Date.now() - session.lastActiveAt.getTime();
    if (staleMs > 60_000) {
      void this.prisma.refreshToken
        .updateMany({
          where: { id: session.id, revokedAt: null },
          data: { lastActiveAt: new Date() },
        })
        .catch(() => undefined);
    }

    return payload;
  }
}
