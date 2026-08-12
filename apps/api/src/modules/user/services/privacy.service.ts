import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConversationType } from '@prisma/client';

import { PrismaService } from '../../../database/prisma.service';
import {
  PeerUserView,
  PrivacyField,
  PrivacyVisibility,
  PRIVACY_FIELDS,
} from '../constants/privacy.constants';
import { UpdatePrivacyDto } from '../dto/update-profile.dto';

import { BlockService } from './block.service';
import { UserService } from './user.service';

@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly blockService: BlockService,
  ) {}

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

  async getVisibility(
    userId: string,
    field: string,
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
        Object.fromEntries(PRIVACY_FIELDS.map((field) => [field, 'EVERYONE'])),
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
    field: string,
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
    const isContact = isSelf || opts.contacts.has(user.id);

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
    const target = await this.userService.findById(targetId);
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
      this.blockService.getBlockedPeerIds(userId),
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

  async assertCanMessage(senderId: string, recipientId: string): Promise<void> {
    await this.blockService.assertNotBlocked(senderId, recipientId);
    const allowed = await this.canView(senderId, recipientId, 'MESSAGES');
    if (!allowed) {
      throw new ForbiddenException(
        'This user does not accept messages from you',
      );
    }
  }

  async assertCanAddToGroup(
    inviterId: string,
    inviteeId: string,
  ): Promise<void> {
    await this.blockService.assertNotBlocked(inviterId, inviteeId);
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
    const allowed = await this.canView(senderId, recipientId, 'VOICE_MESSAGES');
    if (!allowed) {
      throw new ForbiddenException(
        'This user does not accept voice messages from you',
      );
    }
  }
}
