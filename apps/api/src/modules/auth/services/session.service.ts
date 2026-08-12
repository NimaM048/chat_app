import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service';

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
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

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
}
