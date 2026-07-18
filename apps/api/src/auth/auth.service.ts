import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { SafeUser, sanitizeUser } from '../common/utils/sanitize-user';
import { PrismaService } from '../database/prisma.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { UserService } from '../user/user.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface AuthResult {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

export interface SessionView {
  id: string;
  deviceId: string | null;
  deviceName: string | null;
  platform: string | null;
  ip: string | null;
  userAgent: string | null;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface DeviceMeta {
  deviceId?: string;
  deviceName?: string;
  platform?: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async register(
    dto: RegisterDto,
    ip: string,
    userAgent?: string,
  ): Promise<AuthResult> {
    await this.enforceRateLimit('register', ip);

    const [existingEmail, existingUsername] = await Promise.all([
      this.userService.findByEmail(dto.email.toLowerCase()),
      this.userService.findByUsername(dto.username.toLowerCase()),
    ]);

    if (existingEmail) {
      throw new ConflictException('Email is already registered');
    }

    if (existingUsername) {
      throw new ConflictException('Username is already taken');
    }

    const hashedPassword = await argon2.hash(dto.password);
    const user = await this.userService.createUser({
      email: dto.email.toLowerCase(),
      username: dto.username.toLowerCase(),
      displayName: dto.displayName.trim(),
      password: hashedPassword,
    });

    return this.issueTokens(user, {
      deviceId: dto.deviceId,
      deviceName: dto.deviceName,
      platform: dto.platform,
      ip,
      userAgent,
    });
  }

  async login(
    dto: LoginDto,
    ip: string,
    userAgent?: string,
  ): Promise<AuthResult> {
    await this.enforceRateLimit('login', ip);

    const identifier = dto.identifier.toLowerCase().trim();
    const user =
      (await this.userService.findByEmail(identifier)) ??
      (await this.userService.findByUsername(identifier));

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await argon2.verify(user.password, dto.password);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokens(sanitizeUser(user), {
      deviceId: dto.deviceId,
      deviceName: dto.deviceName,
      platform: dto.platform,
      ip,
      userAgent,
    });
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    const user = await this.userService.getSafeUserById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.issueTokens(
      user,
      {
        deviceId: storedToken.deviceId ?? undefined,
        deviceName: storedToken.deviceName ?? undefined,
        platform: storedToken.platform ?? undefined,
        ip: storedToken.ip ?? undefined,
        userAgent: storedToken.userAgent ?? undefined,
      },
      storedToken.id,
    );
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);

    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async listSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<SessionView[]> {
    const sessions = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActiveAt: 'desc' },
    });

    return sessions.map((session) => ({
      id: session.id,
      deviceId: session.deviceId,
      deviceName: session.deviceName ?? 'Unknown device',
      platform: session.platform,
      ip: session.ip,
      userAgent: session.userAgent,
      lastActiveAt: session.lastActiveAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      isCurrent: currentSessionId === session.id,
    }));
  }

  async revokeSession(
    userId: string,
    sessionId: string,
  ): Promise<{ revokedSessionId: string }> {
    const session = await this.prisma.refreshToken.findFirst({
      where: { id: sessionId, userId, revokedAt: null },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.prisma.refreshToken.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    return { revokedSessionId: sessionId };
  }

  async revokeOtherSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<{ revokedCount: number }> {
    const result = await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });

    return { revokedCount: result.count };
  }

  async touchSession(sessionId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { lastActiveAt: new Date() },
    });
  }

  async getProfile(userId: string): Promise<SafeUser> {
    const user = await this.userService.getSafeUserById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  private async issueTokens(
    user: SafeUser,
    device: DeviceMeta = {},
    existingSessionId?: string,
  ): Promise<AuthResult> {
    const sessionId = existingSessionId ?? randomUUID();
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      sid: sessionId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_ACCESS_EXPIRES_IN',
          '15m',
        ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
          '7d',
        ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
      }),
    ]);

    const refreshExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );
    const expiresAt = this.calculateExpiry(refreshExpiresIn);
    const tokenHash = this.hashToken(refreshToken);

    if (existingSessionId) {
      await this.prisma.refreshToken.update({
        where: { id: existingSessionId },
        data: {
          tokenHash,
          expiresAt,
          lastActiveAt: new Date(),
          deviceId: device.deviceId ?? null,
          deviceName: device.deviceName ?? null,
          platform: device.platform ?? null,
          ip: device.ip ?? null,
          userAgent: device.userAgent ?? null,
        },
      });
    } else {
      await this.prisma.refreshToken.create({
        data: {
          id: sessionId,
          tokenHash,
          userId: user.id,
          expiresAt,
          deviceId: device.deviceId ?? null,
          deviceName: device.deviceName ?? null,
          platform: device.platform ?? null,
          ip: device.ip ?? null,
          userAgent: device.userAgent ?? null,
          lastActiveAt: new Date(),
        },
      });
    }

    return {
      user,
      accessToken,
      refreshToken,
      sessionId,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private calculateExpiry(duration: string): Date {
    const match = duration.match(/^(\d+)([smhd])$/);

    if (!match) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    const value = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return new Date(Date.now() + value * multipliers[unit]);
  }

  private async enforceRateLimit(action: string, ip: string): Promise<void> {
    const key = `rate:auth:${action}:${ip || randomBytes(8).toString('hex')}`;
    const result = await this.rateLimitService.consume(key, 10, 60);

    if (!result.allowed) {
      throw new HttpException(
        'Too many attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
