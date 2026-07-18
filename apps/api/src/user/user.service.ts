import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConversationType } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../database/prisma.service';
import { SafeUser, sanitizeUser } from '../common/utils/sanitize-user';
import {
  DeleteAccountDto,
  UpdatePreferencesDto,
  UpdatePrivacyDto,
  UpdateProfileDto,
} from './dto/update-profile.dto';
import {
  PeerUserView,
  PrivacyField,
  PrivacyVisibility,
  PRIVACY_FIELDS,
} from './privacy.constants';

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

  async getOrCreatePreferences(userId: string) {
    const existing = await this.prisma.userPreference.findUnique({
      where: { userId },
    });
    if (existing) return this.mapPreferences(existing);

    const created = await this.prisma.userPreference.create({
      data: { userId },
    });
    return this.mapPreferences(created);
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    await this.getOrCreatePreferences(userId);
    const updated = await this.prisma.userPreference.update({
      where: { userId },
      data: {
        ...(dto.theme !== undefined ? { theme: dto.theme } : {}),
        ...(dto.language !== undefined ? { language: dto.language } : {}),
        ...(dto.sendOnEnter !== undefined
          ? { sendOnEnter: dto.sendOnEnter }
          : {}),
        ...(dto.messagePreview !== undefined
          ? { messagePreview: dto.messagePreview }
          : {}),
        ...(dto.desktopNotifications !== undefined
          ? { desktopNotifications: dto.desktopNotifications }
          : {}),
        ...(dto.soundEnabled !== undefined
          ? { soundEnabled: dto.soundEnabled }
          : {}),
        ...(dto.animationLevel !== undefined
          ? { animationLevel: dto.animationLevel }
          : {}),
        ...(dto.autoDownloadPhotos !== undefined
          ? { autoDownloadPhotos: dto.autoDownloadPhotos }
          : {}),
        ...(dto.autoDownloadVideos !== undefined
          ? { autoDownloadVideos: dto.autoDownloadVideos }
          : {}),
        ...(dto.autoDownloadFiles !== undefined
          ? { autoDownloadFiles: dto.autoDownloadFiles }
          : {}),
        ...(dto.saveToGallery !== undefined
          ? { saveToGallery: dto.saveToGallery }
          : {}),
        ...(dto.fontSize !== undefined ? { fontSize: dto.fontSize } : {}),
        ...(dto.chatBackground !== undefined
          ? { chatBackground: dto.chatBackground }
          : {}),
      },
    });
    return this.mapPreferences(updated);
  }

  async getPrivacy(userId: string): Promise<Record<PrivacyField, string>> {
    let rows = await this.prisma.privacySetting.findMany({
      where: { userId },
    });

    if (rows.length === 0) {
      await this.prisma.privacySetting.createMany({
        data: PRIVACY_FIELDS.map((field) => ({
          userId,
          field,
          visibility: 'EVERYONE',
        })),
      });
      rows = await this.prisma.privacySetting.findMany({ where: { userId } });
    }

    const map = {} as Record<PrivacyField, string>;
    for (const field of PRIVACY_FIELDS) {
      map[field] =
        rows.find((row) => row.field === field)?.visibility ?? 'EVERYONE';
    }
    return map;
  }

  async updatePrivacy(userId: string, dto: UpdatePrivacyDto) {
    await this.prisma.privacySetting.upsert({
      where: {
        userId_field: { userId, field: dto.field },
      },
      create: {
        userId,
        field: dto.field,
        visibility: dto.visibility,
      },
      update: { visibility: dto.visibility },
    });
    return this.getPrivacy(userId);
  }

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
    const target = await this.findById(blockedId);
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

  /** Contact = shares a DIRECT conversation (until Contact model exists). */
  async isContact(a: string, b: string): Promise<boolean> {
    if (a === b) return true;
    const shared = await this.prisma.conversation.findFirst({
      where: {
        type: ConversationType.DIRECT,
        AND: [
          { members: { some: { userId: a } } },
          { members: { some: { userId: b } } },
        ],
      },
      select: { id: true },
    });
    return Boolean(shared);
  }

  async getContactIds(userId: string): Promise<Set<string>> {
    const memberships = await this.prisma.conversationMember.findMany({
      where: {
        userId,
        conversation: { type: ConversationType.DIRECT },
      },
      select: {
        conversation: {
          select: {
            members: {
              where: { userId: { not: userId } },
              select: { userId: true },
            },
          },
        },
      },
    });

    const ids = new Set<string>();
    for (const membership of memberships) {
      for (const peer of membership.conversation.members) {
        ids.add(peer.userId);
      }
    }
    return ids;
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

  async getVisibility(
    userId: string,
    field: PrivacyField | string,
  ): Promise<PrivacyVisibility> {
    const row = await this.prisma.privacySetting.findUnique({
      where: { userId_field: { userId, field } },
    });
    const value = row?.visibility ?? 'EVERYONE';
    if (value === 'CONTACTS' || value === 'NOBODY') return value;
    return 'EVERYONE';
  }

  async getPrivacyMapForUsers(
    userIds: string[],
  ): Promise<Map<string, Record<string, PrivacyVisibility>>> {
    const unique = [...new Set(userIds)];
    const map = new Map<string, Record<string, PrivacyVisibility>>();
    if (unique.length === 0) return map;

    for (const id of unique) {
      map.set(
        id,
        Object.fromEntries(
          PRIVACY_FIELDS.map((field) => [field, 'EVERYONE' as PrivacyVisibility]),
        ),
      );
    }

    const rows = await this.prisma.privacySetting.findMany({
      where: { userId: { in: unique } },
    });
    for (const row of rows) {
      const entry = map.get(row.userId);
      if (!entry) continue;
      const visibility =
        row.visibility === 'CONTACTS' || row.visibility === 'NOBODY'
          ? row.visibility
          : 'EVERYONE';
      entry[row.field] = visibility;
    }
    return map;
  }

  async canView(
    viewerId: string,
    targetId: string,
    field: PrivacyField | string,
    opts?: {
      contacts?: Set<string>;
      privacyMap?: Map<string, Record<string, PrivacyVisibility>>;
    },
  ): Promise<boolean> {
    if (viewerId === targetId) return true;

    const visibility = opts?.privacyMap
      ? (opts.privacyMap.get(targetId)?.[field] ?? 'EVERYONE')
      : await this.getVisibility(targetId, field);

    if (visibility === 'EVERYONE') return true;
    if (visibility === 'NOBODY') return false;

    if (opts?.contacts) {
      return opts.contacts.has(targetId);
    }
    return this.isContact(viewerId, targetId);
  }

  redactPeerUser(
    viewerId: string,
    user: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
      bio?: string | null;
      lastSeenAt?: Date | string | null;
      createdAt: Date | string;
      updatedAt: Date | string;
    },
    opts: {
      contacts: Set<string>;
      privacyMap: Map<string, Record<string, PrivacyVisibility>>;
      includeBio?: boolean;
      includeLastSeen?: boolean;
      isOnline?: boolean;
    },
  ): PeerUserView {
    const privacy = opts.privacyMap.get(user.id) ?? {};
    const isSelf = viewerId === user.id;
    const isContact =
      isSelf || opts.contacts.has(user.id);

    const allows = (field: string) => {
      if (isSelf) return true;
      const visibility = privacy[field] ?? 'EVERYONE';
      if (visibility === 'EVERYONE') return true;
      if (visibility === 'NOBODY') return false;
      return isContact;
    };

    const createdAt =
      typeof user.createdAt === 'string'
        ? user.createdAt
        : user.createdAt.toISOString();
    const updatedAt =
      typeof user.updatedAt === 'string'
        ? user.updatedAt
        : user.updatedAt.toISOString();

    const view: PeerUserView = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: allows('PROFILE_PHOTO') ? user.avatarUrl : null,
      createdAt,
      updatedAt,
    };

    if (opts.includeBio) {
      view.bio = allows('BIO') ? (user.bio ?? null) : null;
    }

    if (opts.includeLastSeen) {
      if (allows('LAST_SEEN')) {
        const raw = user.lastSeenAt;
        view.lastSeenAt =
          raw == null
            ? null
            : typeof raw === 'string'
              ? raw
              : raw.toISOString();
        if (opts.isOnline !== undefined) {
          view.isOnline = opts.isOnline;
        }
      } else {
        view.lastSeenAt = null;
        view.isOnline = undefined;
      }
    }

    return view;
  }

  async toPublicProfile(
    viewerId: string,
    targetId: string,
    opts?: { isOnline?: boolean },
  ) {
    const target = await this.findById(targetId);
    if (!target) {
      throw new NotFoundException('User not found');
    }

    const [blockedByViewer, blockedByTarget, contacts, privacyMap] =
      await Promise.all([
        this.prisma.userBlock.findUnique({
          where: {
            ownerId_blockedId: { ownerId: viewerId, blockedId: targetId },
          },
        }),
        this.prisma.userBlock.findUnique({
          where: {
            ownerId_blockedId: { ownerId: targetId, blockedId: viewerId },
          },
        }),
        this.getContactIds(viewerId),
        this.getPrivacyMapForUsers([targetId]),
      ]);

    const profile = this.redactPeerUser(viewerId, target, {
      contacts,
      privacyMap,
      includeBio: true,
      includeLastSeen: true,
      isOnline: opts?.isOnline,
    });

    return {
      ...profile,
      isBlocked: Boolean(blockedByViewer),
      hasBlockedYou: Boolean(blockedByTarget),
    };
  }

  async assertCanMessage(senderId: string, recipientId: string): Promise<void> {
    await this.assertNotBlocked(senderId, recipientId);
    const allowed = await this.canView(senderId, recipientId, 'MESSAGES');
    if (!allowed) {
      throw new ForbiddenException('This user does not accept messages from you');
    }
  }

  async assertCanAddToGroup(
    inviterId: string,
    inviteeId: string,
  ): Promise<void> {
    await this.assertNotBlocked(inviterId, inviteeId);
    const allowed = await this.canView(inviterId, inviteeId, 'GROUPS');
    if (!allowed) {
      throw new ForbiddenException(
        'This user does not allow being added to groups',
      );
    }
  }

  async assertCanForwardFrom(
    forwarderId: string,
    originalSenderId: string,
  ): Promise<void> {
    if (forwarderId === originalSenderId) return;
    const allowed = await this.canView(
      forwarderId,
      originalSenderId,
      'FORWARDS',
    );
    if (!allowed) {
      throw new ForbiddenException(
        'This user does not allow forwarding their messages',
      );
    }
  }

  async assertCanSendVoice(
    senderId: string,
    recipientId: string,
  ): Promise<void> {
    const allowed = await this.canView(
      senderId,
      recipientId,
      'VOICE_MESSAGES',
    );
    if (!allowed) {
      throw new ForbiddenException(
        'This user does not accept voice messages from you',
      );
    }
  }

  async touchLastSeen(userId: string): Promise<Date> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
      select: { lastSeenAt: true },
    });
    return updated.lastSeenAt!;
  }

  async getPresenceRecipientIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId },
      select: {
        conversation: {
          select: {
            members: {
              where: { userId: { not: userId } },
              select: { userId: true },
            },
          },
        },
      },
    });

    const peerIds = new Set<string>();
    for (const membership of memberships) {
      for (const peer of membership.conversation.members) {
        peerIds.add(peer.userId);
      }
    }

    if (peerIds.size === 0) return [];

    const [contacts, privacyMap, blocked] = await Promise.all([
      this.getContactIds(userId),
      this.getPrivacyMapForUsers([userId]),
      this.getBlockedPeerIds(userId),
    ]);

    const visibility = privacyMap.get(userId)?.LAST_SEEN ?? 'EVERYONE';
    const recipients: string[] = [];
    for (const peerId of peerIds) {
      if (blocked.has(peerId)) continue;
      if (visibility === 'NOBODY') continue;
      if (visibility === 'CONTACTS' && !contacts.has(peerId)) continue;
      recipients.push(peerId);
    }
    return recipients;
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

  private mapPreferences(row: {
    theme: string;
    language: string;
    sendOnEnter: boolean;
    messagePreview: boolean;
    desktopNotifications: boolean;
    soundEnabled: boolean;
    animationLevel: string;
    autoDownloadPhotos: boolean;
    autoDownloadVideos: boolean;
    autoDownloadFiles: boolean;
    saveToGallery: boolean;
    fontSize: number;
    chatBackground: string | null;
    updatedAt: Date;
  }) {
    return {
      theme: row.theme,
      language: row.language,
      sendOnEnter: row.sendOnEnter,
      messagePreview: row.messagePreview,
      desktopNotifications: row.desktopNotifications,
      soundEnabled: row.soundEnabled,
      animationLevel: row.animationLevel,
      autoDownloadPhotos: row.autoDownloadPhotos,
      autoDownloadVideos: row.autoDownloadVideos,
      autoDownloadFiles: row.autoDownloadFiles,
      saveToGallery: row.saveToGallery,
      fontSize: row.fontSize,
      chatBackground: row.chatBackground,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
