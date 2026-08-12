import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service';

import { UserService } from './user.service';

@Injectable()
export class BlockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  async listBlocked(userId: string) {
    const rows = await this.prisma.userBlock.findMany({
      where: { ownerId: userId },
      include: {
        blocked: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      blockedAt: row.createdAt.toISOString(),
      user: {
        ...row.blocked,
        createdAt: row.blocked.createdAt.toISOString(),
        updatedAt: row.blocked.updatedAt.toISOString(),
      },
    }));
  }

  async blockUser(ownerId: string, blockedId: string) {
    if (ownerId === blockedId) {
      throw new BadRequestException('Cannot block yourself');
    }
    const target = await this.userService.findById(blockedId);
    if (!target) throw new NotFoundException('User not found');

    await this.prisma.userBlock.upsert({
      where: {
        ownerId_blockedId: { ownerId, blockedId },
      },
      create: { ownerId, blockedId },
      update: {},
    });
    return { blocked: true, userId: blockedId };
  }

  async unblockUser(ownerId: string, blockedId: string) {
    await this.prisma.userBlock.deleteMany({
      where: { ownerId, blockedId },
    });
    return { blocked: false, userId: blockedId };
  }

  async areBlocked(a: string, b: string): Promise<boolean> {
    if (a === b) return false;
    const row = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { ownerId: a, blockedId: b },
          { ownerId: b, blockedId: a },
        ],
      },
      select: { id: true },
    });
    return Boolean(row);
  }

  async assertNotBlocked(a: string, b: string): Promise<void> {
    if (await this.areBlocked(a, b)) {
      throw new ForbiddenException('You cannot interact with this user');
    }
  }

  async getBlockedPeerIds(userId: string): Promise<Set<string>> {
    const rows = await this.prisma.userBlock.findMany({
      where: {
        OR: [{ ownerId: userId }, { blockedId: userId }],
      },
      select: { ownerId: true, blockedId: true },
    });
    const ids = new Set<string>();
    for (const row of rows) {
      ids.add(row.ownerId === userId ? row.blockedId : row.ownerId);
    }
    return ids;
  }
}
