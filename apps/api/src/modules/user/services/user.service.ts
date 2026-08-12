import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';

import { PrismaService } from '../../../database/prisma.service';
import { SafeUser, sanitizeUser } from '../../../utils/sanitize-user';
import { PRIVACY_FIELDS } from '../constants/privacy.constants';
import { DeleteAccountDto, UpdateProfileDto } from '../dto/update-profile.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createUser(data: {
    email: string;
    username: string;
    password: string;
    displayName: string;
  }): Promise<SafeUser> {
    const user = await this.prisma.user.create({
      data: {
        ...data,
        preference: { create: {} },
        privacy: {
          create: PRIVACY_FIELDS.map((field) => ({
            field,
            visibility: 'EVERYONE',
          })),
        },
      },
    });
    return sanitizeUser(user);
  }

  async getSafeUserById(id: string): Promise<SafeUser | null> {
    const user = await this.findById(id);
    return user ? sanitizeUser(user) : null;
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<SafeUser> {
    const existing = await this.findById(userId);
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const data: {
      displayName?: string;
      username?: string;
      avatarUrl?: string | null;
      bio?: string | null;
    } = {};

    if (dto.displayName !== undefined) {
      const displayName = dto.displayName.trim();
      if (!displayName) {
        throw new BadRequestException('Display name cannot be empty');
      }
      data.displayName = displayName;
    }

    if (dto.username !== undefined) {
      const username = dto.username.trim().toLowerCase();
      if (!username) {
        throw new BadRequestException('Username cannot be empty');
      }
      const taken = await this.prisma.user.findFirst({
        where: { username, id: { not: userId } },
      });
      if (taken) {
        throw new ConflictException('Username is already taken');
      }
      data.username = username;
    }

    if (dto.avatarUrl !== undefined) {
      data.avatarUrl = dto.avatarUrl;
    }

    if (dto.bio !== undefined) {
      data.bio = dto.bio?.trim() ? dto.bio.trim().slice(0, 70) : null;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No profile fields to update');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    return sanitizeUser(updated);
  }

  async touchLastSeen(userId: string): Promise<Date> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
      select: { lastSeenAt: true },
    });
    return updated.lastSeenAt!;
  }

  async getMemberNotifyPolicy(
    userId: string,
    conversationId: string,
  ): Promise<{
    suppressNotification: boolean;
    messagePreview: boolean;
    desktopNotifications: boolean;
    soundEnabled: boolean;
  }> {
    const [membership, preference] = await Promise.all([
      this.prisma.conversationMember.findUnique({
        where: {
          conversationId_userId: { conversationId, userId },
        },
        select: { mutedUntil: true },
      }),
      this.prisma.userPreference.findUnique({
        where: { userId },
        select: {
          messagePreview: true,
          desktopNotifications: true,
          soundEnabled: true,
        },
      }),
    ]);

    const muted =
      membership?.mutedUntil != null &&
      membership.mutedUntil.getTime() > Date.now();

    return {
      suppressNotification: muted || preference?.desktopNotifications === false,
      messagePreview: preference?.messagePreview ?? true,
      desktopNotifications: preference?.desktopNotifications ?? true,
      soundEnabled: preference?.soundEnabled ?? true,
    };
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const valid = await argon2.verify(user.password, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Incorrect password');
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
  }
}
