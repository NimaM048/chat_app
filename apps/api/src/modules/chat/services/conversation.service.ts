import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConversationType } from '@prisma/client';

import { PrismaService } from '../../../database/prisma.service';
import { PrivacyService } from '../../user/services/privacy.service';
import { UserService } from '../../user/services/user.service';
import {
  conversationDetailInclude,
  sortConversations,
} from '../constants/conversation.helpers';

import { ChatMapperService } from './chat-mapper.service';

@Injectable()
export class ConversationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly privacyService: PrivacyService,
    private readonly mapper: ChatMapperService,
  ) {}

  async listConversations(userId: string) {
    await this.ensureSavedMessages(userId);

    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId },
      include: {
        conversation: {
          include: conversationDetailInclude,
        },
      },
      orderBy: {
        conversation: {
          lastMessageAt: 'desc',
        },
      },
    });

    const drafts = await this.prisma.draft.findMany({
      where: { userId },
    });
    const draftByConversation = new Map(
      drafts.map((draft) => [draft.conversationId, draft.content]),
    );

    const peerIds = [
      ...new Set(
        memberships.flatMap((membership) =>
          membership.conversation.members.map((member) => member.user.id),
        ),
      ),
    ];
    const privacyContext = await this.mapper.buildPrivacyContext(
      userId,
      peerIds,
    );

    const mapped = await Promise.all(
      memberships.map(async (membership) => {
        const conversation = membership.conversation;
        const lastMessage = conversation.messages[0] ?? null;
        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: conversation.id,
            senderId: { not: userId },
            ...(membership.lastReadAt
              ? { createdAt: { gt: membership.lastReadAt } }
              : {}),
          },
        });

        return this.mapper.mapConversation(
          conversation,
          userId,
          lastMessage,
          membership.markedUnread ? Math.max(unreadCount, 1) : unreadCount,
          {
            isArchived: membership.isArchived,
            isPinned: membership.isPinned,
            pinOrder: membership.pinOrder,
            mutedUntil: membership.mutedUntil,
            markedUnread: membership.markedUnread,
            draft: draftByConversation.get(conversation.id) ?? null,
          },
          privacyContext,
        );
      }),
    );

    return sortConversations(mapped);
  }

  async ensureSavedMessages(userId: string) {
    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: ConversationType.SAVED,
        members: { some: { userId } },
      },
      include: conversationDetailInclude,
    });

    if (existing) {
      return this.mapper.mapConversation(
        existing,
        userId,
        existing.messages[0] ?? null,
        0,
      );
    }

    const created = await this.prisma.conversation.create({
      data: {
        type: ConversationType.SAVED,
        title: 'Saved Messages',
        members: {
          create: { userId },
        },
      },
      include: conversationDetailInclude,
    });

    return this.mapper.mapConversation(created, userId, null, 0);
  }

  async createGroupConversation(
    userId: string,
    title: string,
    memberRefs: string[],
  ) {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      throw new BadRequestException('Group title is required');
    }

    const uniqueRefs = [
      ...new Set(memberRefs.map((item) => item.trim()).filter(Boolean)),
    ];
    if (uniqueRefs.length < 1) {
      throw new BadRequestException('Add at least one member');
    }

    const memberIds = new Set<string>([userId]);
    for (const ref of uniqueRefs) {
      const user =
        (await this.userService.findByUsername(ref.toLowerCase())) ??
        (await this.userService.findById(ref)) ??
        (await this.userService.findByEmail(ref.toLowerCase()));
      if (!user) {
        throw new NotFoundException(`User not found: ${ref}`);
      }
      if (user.id !== userId) {
        await this.privacyService.assertCanAddToGroup(userId, user.id);
        memberIds.add(user.id);
      }
    }

    if (memberIds.size < 2) {
      throw new BadRequestException('A group needs at least two members');
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        type: ConversationType.GROUP,
        title: trimmedTitle,
        members: {
          create: [...memberIds].map((id) => ({ userId: id })),
        },
      },
      include: conversationDetailInclude,
    });

    return this.mapper.mapConversation(conversation, userId, null, 0);
  }

  async toggleArchive(userId: string, conversationId: string) {
    const membership = await this.mapper.assertMembership(
      userId,
      conversationId,
    );
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (conversation.type === ConversationType.SAVED) {
      throw new BadRequestException('Saved Messages cannot be archived');
    }

    const updated = await this.prisma.conversationMember.update({
      where: { id: membership.id },
      data: { isArchived: !membership.isArchived },
      include: {
        conversation: {
          include: conversationDetailInclude,
        },
      },
    });

    return this.mapper.mapConversation(
      updated.conversation,
      userId,
      updated.conversation.messages[0] ?? null,
      0,
      {
        isArchived: updated.isArchived,
        isPinned: updated.isPinned,
        pinOrder: updated.pinOrder,
        mutedUntil: updated.mutedUntil,
        markedUnread: updated.markedUnread,
      },
    );
  }

  async updateMemberSettings(
    userId: string,
    conversationId: string,
    patch: {
      mutedUntil?: string | null;
      isArchived?: boolean;
      isPinned?: boolean;
      markedUnread?: boolean;
    },
  ) {
    const membership = await this.mapper.assertMembership(
      userId,
      conversationId,
    );
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (
      patch.isArchived === true &&
      conversation.type === ConversationType.SAVED
    ) {
      throw new BadRequestException('Saved Messages cannot be archived');
    }

    let pinOrder = membership.pinOrder;
    if (patch.isPinned === true && !membership.isPinned) {
      const maxPin = await this.prisma.conversationMember.aggregate({
        where: { userId, isPinned: true },
        _max: { pinOrder: true },
      });
      pinOrder = (maxPin._max.pinOrder ?? 0) + 1;
    }
    if (patch.isPinned === false) {
      pinOrder = null;
    }

    let mutedUntil: Date | null | undefined = undefined;
    if (patch.mutedUntil !== undefined) {
      if (patch.mutedUntil === null) {
        mutedUntil = null;
      } else {
        const parsed = new Date(patch.mutedUntil);
        if (Number.isNaN(parsed.getTime())) {
          throw new BadRequestException('Invalid mutedUntil');
        }
        mutedUntil = parsed;
      }
    }

    const updated = await this.prisma.conversationMember.update({
      where: { id: membership.id },
      data: {
        ...(patch.isArchived !== undefined
          ? { isArchived: patch.isArchived }
          : {}),
        ...(patch.isPinned !== undefined
          ? { isPinned: patch.isPinned, pinOrder }
          : {}),
        ...(mutedUntil !== undefined ? { mutedUntil } : {}),
        ...(patch.markedUnread !== undefined
          ? { markedUnread: patch.markedUnread }
          : {}),
      },
      include: {
        conversation: {
          include: conversationDetailInclude,
        },
      },
    });

    const draft = await this.prisma.draft.findUnique({
      where: {
        userId_conversationId: { userId, conversationId },
      },
    });

    return this.mapper.mapConversation(
      updated.conversation,
      userId,
      updated.conversation.messages[0] ?? null,
      0,
      {
        isArchived: updated.isArchived,
        isPinned: updated.isPinned,
        pinOrder: updated.pinOrder,
        mutedUntil: updated.mutedUntil,
        markedUnread: updated.markedUnread,
        draft: draft?.content ?? null,
      },
    );
  }

  async createDirectConversation(userId: string, peer: string) {
    const peerUser =
      (await this.userService.findByUsername(peer.toLowerCase())) ??
      (await this.userService.findById(peer)) ??
      (await this.userService.findByEmail(peer.toLowerCase()));

    if (!peerUser) {
      throw new NotFoundException('User not found');
    }

    if (peerUser.id === userId) {
      throw new ForbiddenException('Cannot start a conversation with yourself');
    }

    await this.privacyService.assertCanMessage(userId, peerUser.id);

    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: ConversationType.DIRECT,
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: peerUser.id } } },
        ],
      },
      include: conversationDetailInclude,
    });

    if (existing) {
      return this.mapper.mapConversation(
        existing,
        userId,
        existing.messages[0] ?? null,
        0,
      );
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        type: ConversationType.DIRECT,
        members: {
          create: [{ userId }, { userId: peerUser.id }],
        },
      },
      include: conversationDetailInclude,
    });

    return this.mapper.mapConversation(conversation, userId, null, 0);
  }

  async getMemberIds(conversationId: string): Promise<string[]> {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    return members.map((member) => member.userId);
  }
}
