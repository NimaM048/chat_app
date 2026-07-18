import {
  ForbiddenException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConversationType, MessageStatus, MessageType, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { UserService } from '../user/user.service';

const memberUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const messageInclude = {
  sender: { select: memberUserSelect },
  replyTo: {
    select: {
      id: true,
      content: true,
      senderId: true,
      sender: { select: { id: true, displayName: true, username: true } },
    },
  },
  forwardedFrom: {
    select: {
      id: true,
      content: true,
      sender: { select: { id: true, displayName: true, username: true } },
    },
  },
  reactions: {
    select: {
      emoji: true,
      userId: true,
    },
  },
} satisfies Prisma.MessageInclude;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  async listConversations(userId: string) {
    await this.ensureSavedMessages(userId);

    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            members: {
              include: { user: { select: memberUserSelect } },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: messageInclude,
            },
          },
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
    const privacyContext = await this.buildPrivacyContext(userId, peerIds);

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

        return this.mapConversation(
          conversation,
          userId,
          lastMessage,
          membership.markedUnread
            ? Math.max(unreadCount, 1)
            : unreadCount,
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

    return mapped.sort((a, b) => {
      if (a.type === ConversationType.SAVED && b.type !== ConversationType.SAVED) {
        return -1;
      }
      if (b.type === ConversationType.SAVED && a.type !== ConversationType.SAVED) {
        return 1;
      }
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      if (a.isPinned && b.isPinned) {
        return (a.pinOrder ?? 0) - (b.pinOrder ?? 0);
      }
      const aTime = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
      const bTime = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
      return bTime - aTime;
    });
  }

  async ensureSavedMessages(userId: string) {
    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: ConversationType.SAVED,
        members: { some: { userId } },
      },
      include: {
        members: {
          include: { user: { select: memberUserSelect } },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: messageInclude,
        },
      },
    });

    if (existing) {
      return this.mapConversation(
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
      include: {
        members: {
          include: { user: { select: memberUserSelect } },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: messageInclude,
        },
      },
    });

    return this.mapConversation(created, userId, null, 0);
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

    const uniqueRefs = [...new Set(memberRefs.map((item) => item.trim()).filter(Boolean))];
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
        await this.userService.assertCanAddToGroup(userId, user.id);
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
      include: {
        members: {
          include: { user: { select: memberUserSelect } },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: messageInclude,
        },
      },
    });

    return this.mapConversation(conversation, userId, null, 0);
  }

  async toggleArchive(userId: string, conversationId: string) {
    const membership = await this.assertMembership(userId, conversationId);
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
          include: {
            members: {
              include: { user: { select: memberUserSelect } },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: messageInclude,
            },
          },
        },
      },
    });

    return this.mapConversation(
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
    const membership = await this.assertMembership(userId, conversationId);
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
          include: {
            members: {
              include: { user: { select: memberUserSelect } },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: messageInclude,
            },
          },
        },
      },
    });

    const draft = await this.prisma.draft.findUnique({
      where: {
        userId_conversationId: { userId, conversationId },
      },
    });

    return this.mapConversation(
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

  async upsertDraft(
    userId: string,
    conversationId: string,
    content: string,
    replyToId?: string | null,
  ) {
    await this.assertMembership(userId, conversationId);
    const trimmed = content.trim();

    if (!trimmed) {
      await this.prisma.draft.deleteMany({
        where: { userId, conversationId },
      });
      return {
        conversationId,
        content: null,
        updatedAt: null,
      };
    }

    const draft = await this.prisma.draft.upsert({
      where: {
        userId_conversationId: { userId, conversationId },
      },
      create: {
        userId,
        conversationId,
        content: trimmed,
        replyToId: replyToId ?? null,
      },
      update: {
        content: trimmed,
        replyToId: replyToId ?? null,
      },
    });

    return {
      conversationId,
      content: draft.content,
      updatedAt: draft.updatedAt.toISOString(),
    };
  }

  async deleteDraft(userId: string, conversationId: string) {
    await this.assertMembership(userId, conversationId);
    await this.prisma.draft.deleteMany({
      where: { userId, conversationId },
    });
    return {
      conversationId,
      content: null,
      updatedAt: null,
    };
  }

  async batchForwardMessages(
    userId: string,
    messageIds: string[],
    targetConversationId: string,
  ) {
    const uniqueIds = [...new Set(messageIds)];
    if (uniqueIds.length === 0) {
      throw new BadRequestException('No messages selected');
    }

    const results = [];
    for (const messageId of uniqueIds) {
      results.push(
        await this.forwardMessage(userId, messageId, targetConversationId),
      );
    }
    return results;
  }

  async batchDeleteMessages(userId: string, messageIds: string[]) {
    const uniqueIds = [...new Set(messageIds)];
    if (uniqueIds.length === 0) {
      throw new BadRequestException('No messages selected');
    }

    const results = [];
    for (const messageId of uniqueIds) {
      results.push(await this.deleteMessage(userId, messageId));
    }
    return results;
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

    await this.userService.assertCanMessage(userId, peerUser.id);

    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: ConversationType.DIRECT,
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: peerUser.id } } },
        ],
      },
      include: {
        members: {
          include: { user: { select: memberUserSelect } },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: messageInclude,
        },
      },
    });

    if (existing) {
      return this.mapConversation(
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
      include: {
        members: {
          include: { user: { select: memberUserSelect } },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: messageInclude,
        },
      },
    });

    return this.mapConversation(conversation, userId, null, 0);
  }

  async getMessages(
    userId: string,
    conversationId: string,
    cursor?: string,
    take = 40,
  ) {
    await this.assertMembership(userId, conversationId);

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      include: messageInclude,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
    });

    const hasMore = messages.length > take;
    const items = hasMore ? messages.slice(0, take) : messages;
    const privacyContext = await this.buildPrivacyContext(
      userId,
      items.map((message) => message.senderId),
    );

    return {
      items: items
        .reverse()
        .map((message) => this.mapMessage(message, userId, privacyContext)),
      nextCursor: hasMore ? items[0]?.id : null,
    };
  }

  async getPinnedMessages(userId: string, conversationId: string) {
    await this.assertMembership(userId, conversationId);

    const messages = await this.prisma.message.findMany({
      where: { conversationId, isPinned: true },
      include: messageInclude,
      orderBy: { updatedAt: 'desc' },
    });

    return messages.map((message) => this.mapMessage(message, userId));
  }

  async createMessage(
    userId: string,
    conversationId: string,
    content: string,
    replyToId?: string,
    media?: {
      type?: MessageType;
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      durationMs?: number;
      forwardedFromId?: string;
    },
  ) {
    await this.assertMembership(userId, conversationId);

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        members: { select: { userId: true } },
      },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.type === ConversationType.DIRECT) {
      const peerId = conversation.members.find((m) => m.userId !== userId)
        ?.userId;
      if (peerId) {
        await this.userService.assertNotBlocked(userId, peerId);
        await this.userService.assertCanMessage(userId, peerId);
        if ((media?.type ?? MessageType.TEXT) === MessageType.VOICE) {
          await this.userService.assertCanSendVoice(userId, peerId);
        }
      }
    }

    if (replyToId) {
      const replyTarget = await this.prisma.message.findFirst({
        where: { id: replyToId, conversationId },
      });
      if (!replyTarget) {
        throw new NotFoundException('Reply target not found');
      }
    }

    await this.prisma.draft.deleteMany({
      where: { userId, conversationId },
    });

    const type = media?.type ?? MessageType.TEXT;
    const trimmed = content.trim();
    if (type === MessageType.TEXT && !trimmed) {
      throw new BadRequestException('Message content cannot be empty');
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          senderId: userId,
          content: trimmed,
          type,
          status: MessageStatus.SENT,
          replyToId: replyToId ?? null,
          forwardedFromId: media?.forwardedFromId ?? null,
          fileUrl: media?.fileUrl,
          fileName: media?.fileName,
          fileSize: media?.fileSize,
          mimeType: media?.mimeType,
          durationMs: media?.durationMs,
        },
        include: messageInclude,
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: created.createdAt },
      });

      await tx.conversationMember.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
        data: { lastReadAt: created.createdAt },
      });

      return created;
    });

    return this.mapMessage(message, userId);
  }

  async forwardMessage(
    userId: string,
    messageId: string,
    targetConversationId: string,
  ) {
    const source = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: messageInclude,
    });

    if (!source) {
      throw new NotFoundException('Message not found');
    }

    await this.assertMembership(userId, source.conversationId);
    await this.assertMembership(userId, targetConversationId);
    await this.userService.assertCanForwardFrom(userId, source.senderId);

    return this.createMessage(userId, targetConversationId, source.content, undefined, {
      type: source.type,
      fileUrl: source.fileUrl ?? undefined,
      fileName: source.fileName ?? undefined,
      fileSize: source.fileSize ?? undefined,
      mimeType: source.mimeType ?? undefined,
      durationMs: source.durationMs ?? undefined,
      forwardedFromId: source.id,
    });
  }

  async togglePin(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.assertMembership(userId, message.conversationId);

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { isPinned: !message.isPinned },
      include: messageInclude,
    });

    return this.mapMessage(updated);
  }

  async editMessage(userId: string, messageId: string, content: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    if (message.deletedAt) {
      throw new BadRequestException('Cannot edit a deleted message');
    }

    if (message.type !== MessageType.TEXT) {
      throw new BadRequestException('Only text messages can be edited');
    }

    const trimmed = content.trim();
    if (!trimmed) {
      throw new BadRequestException('Message content cannot be empty');
    }

    await this.assertMembership(userId, message.conversationId);

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        content: trimmed,
        editedAt: new Date(),
      },
      include: messageInclude,
    });

    return this.mapMessage(updated);
  }

  async deleteMessage(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    if (message.deletedAt) {
      return this.mapMessage(
        await this.prisma.message.findUniqueOrThrow({
          where: { id: messageId },
          include: messageInclude,
        }),
      );
    }

    await this.assertMembership(userId, message.conversationId);

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        content: '',
        fileUrl: null,
        fileName: null,
        fileSize: null,
        mimeType: null,
        durationMs: null,
        isPinned: false,
      },
      include: messageInclude,
    });

    return this.mapMessage(updated);
  }

  async toggleReaction(userId: string, messageId: string, emoji: string) {
    const trimmed = emoji.trim();
    if (!trimmed) {
      throw new BadRequestException('Emoji is required');
    }

    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.deletedAt) {
      throw new BadRequestException('Cannot react to a deleted message');
    }

    await this.assertMembership(userId, message.conversationId);

    const existing = await this.prisma.messageReaction.findUnique({
      where: {
        messageId_userId: { messageId, userId },
      },
    });

    if (existing && existing.emoji === trimmed) {
      await this.prisma.messageReaction.delete({
        where: { id: existing.id },
      });
    } else if (existing) {
      await this.prisma.messageReaction.update({
        where: { id: existing.id },
        data: { emoji: trimmed },
      });
    } else {
      await this.prisma.messageReaction.create({
        data: { messageId, userId, emoji: trimmed },
      });
    }

    const updated = await this.prisma.message.findUniqueOrThrow({
      where: { id: messageId },
      include: messageInclude,
    });

    return this.mapMessage(updated, userId);
  }

  async markDelivered(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: messageInclude,
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.assertMembership(userId, message.conversationId);

    if (message.senderId === userId || message.status !== MessageStatus.SENT) {
      return this.mapMessage(message);
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { status: MessageStatus.DELIVERED },
      include: messageInclude,
    });
    return this.mapMessage(updated);
  }

  async markConversationSeen(userId: string, conversationId: string) {
    await this.assertMembership(userId, conversationId);

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.conversationMember.update({
        where: {
          conversationId_userId: { conversationId, userId },
        },
        data: { lastReadAt: now, markedUnread: false },
      }),
      this.prisma.message.updateMany({
        where: {
          conversationId,
          senderId: { not: userId },
          status: { in: [MessageStatus.SENT, MessageStatus.DELIVERED] },
        },
        data: { status: MessageStatus.SEEN },
      }),
    ]);

    return { conversationId, seenAt: now.toISOString(), seenBy: userId };
  }

  async getMemberIds(conversationId: string): Promise<string[]> {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    return members.map((member) => member.userId);
  }

  async searchUsers(userId: string, query: string) {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [];
    }

    const blockedIds = await this.userService.getBlockedPeerIds(userId);
    const excluded = [userId, ...blockedIds];
    const users = await this.prisma.user.findMany({
      where: {
        id: { notIn: excluded },
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 20,
      select: memberUserSelect,
    });

    const privacyContext = await this.buildPrivacyContext(
      userId,
      users.map((user) => user.id),
    );

    return users.map((user) =>
      this.userService.redactPeerUser(userId, user, {
        contacts: privacyContext.contacts,
        privacyMap: privacyContext.privacyMap,
      }),
    );
  }

  async globalSearch(userId: string, query: string) {
    const q = query.trim();
    if (q.length < 2) {
      return { users: [], conversations: [], messages: [] };
    }

    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId },
      select: { conversationId: true },
    });
    const conversationIds = memberships.map((item) => item.conversationId);

    const [users, conversations, messages] = await Promise.all([
      this.searchUsers(userId, q),
      conversationIds.length === 0
        ? Promise.resolve([])
        : this.prisma.conversation.findMany({
            where: {
              id: { in: conversationIds },
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                {
                  members: {
                    some: {
                      userId: { not: userId },
                      user: {
                        OR: [
                          { username: { contains: q, mode: 'insensitive' } },
                          {
                            displayName: { contains: q, mode: 'insensitive' },
                          },
                        ],
                      },
                    },
                  },
                },
              ],
            },
            include: {
              members: { include: { user: { select: memberUserSelect } } },
              messages: {
                take: 1,
                orderBy: { createdAt: 'desc' },
                include: messageInclude,
              },
            },
            take: 12,
            orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
          }),
      conversationIds.length === 0
        ? Promise.resolve([])
        : this.prisma.message.findMany({
            where: {
              conversationId: { in: conversationIds },
              deletedAt: null,
              OR: [
                { content: { contains: q, mode: 'insensitive' } },
                { fileName: { contains: q, mode: 'insensitive' } },
              ],
            },
            include: {
              ...messageInclude,
              conversation: {
                select: {
                  id: true,
                  type: true,
                  title: true,
                  members: {
                    include: { user: { select: memberUserSelect } },
                  },
                },
              },
            },
            take: 20,
            orderBy: { createdAt: 'desc' },
          }),
    ]);

    const mappedConversations = await Promise.all(
      conversations.map(async (conversation) => {
        const membership = await this.prisma.conversationMember.findUnique({
          where: {
            conversationId_userId: {
              conversationId: conversation.id,
              userId,
            },
          },
        });
        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: conversation.id,
            senderId: { not: userId },
            createdAt: {
              gt: membership?.lastReadAt ?? new Date(0),
            },
            deletedAt: null,
          },
        });
        return this.mapConversation(
          conversation,
          userId,
          conversation.messages[0] ?? null,
          unreadCount,
          {
            isArchived: membership?.isArchived ?? false,
            isPinned: membership?.isPinned ?? false,
            pinOrder: membership?.pinOrder ?? null,
            mutedUntil: membership?.mutedUntil ?? null,
            markedUnread: membership?.markedUnread ?? false,
          },
        );
      }),
    );

    return {
      users,
      conversations: mappedConversations,
      messages: messages.map((message) => {
        const conversation = message.conversation;
        const peer =
          conversation.type === ConversationType.SAVED ||
          conversation.type === ConversationType.GROUP
            ? null
            : conversation.members.find((member) => member.userId !== userId)
                ?.user;
        const title =
          conversation.type === ConversationType.SAVED
            ? 'Saved Messages'
            : conversation.type === ConversationType.GROUP
              ? conversation.title || 'Group'
              : peer?.displayName || peer?.username || 'Chat';

        return {
          ...this.mapMessage(message, userId),
          conversationTitle: title,
        };
      }),
    };
  }

  private async buildPrivacyContext(
    viewerId: string,
    userIds: string[],
  ): Promise<{
    contacts: Set<string>;
    privacyMap: Map<
      string,
      Record<string, import('../user/privacy.constants').PrivacyVisibility>
    >;
  }> {
    const [contacts, privacyMap] = await Promise.all([
      this.userService.getContactIds(viewerId),
      this.userService.getPrivacyMapForUsers(userIds),
    ]);
    return { contacts, privacyMap };
  }

  private async assertMembership(userId: string, conversationId: string) {
    const membership = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    return membership;
  }

  private async mapConversation(
    conversation: {
      id: string;
      type: ConversationType;
      title: string | null;
      createdAt: Date;
      updatedAt: Date;
      lastMessageAt: Date | null;
      members: Array<{
        userId: string;
        user: {
          id: string;
          username: string;
          displayName: string;
          avatarUrl: string | null;
          createdAt: Date;
          updatedAt: Date;
        };
      }>;
    },
    currentUserId: string,
    lastMessage: Parameters<ChatService['mapMessage']>[0] | null,
    unreadCount: number,
    memberState: {
      isArchived?: boolean;
      isPinned?: boolean;
      pinOrder?: number | null;
      mutedUntil?: Date | null;
      markedUnread?: boolean;
      draft?: string | null;
    } = {},
    privacyContext?: {
      contacts: Set<string>;
      privacyMap: Map<
        string,
        Record<string, import('../user/privacy.constants').PrivacyVisibility>
      >;
    },
  ) {
    const ctx =
      privacyContext ??
      (await this.buildPrivacyContext(
        currentUserId,
        conversation.members.map((member) => member.user.id),
      ));

    const redact = (user: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
      createdAt: Date;
      updatedAt: Date;
    }) =>
      this.userService.redactPeerUser(currentUserId, user, {
        contacts: ctx.contacts,
        privacyMap: ctx.privacyMap,
      });

    const peer =
      conversation.type === ConversationType.SAVED ||
      conversation.type === ConversationType.GROUP
        ? null
        : conversation.members.find((member) => member.userId !== currentUserId)
            ?.user;

    const mutedUntil = memberState.mutedUntil ?? null;
    const isMuted =
      mutedUntil !== null && mutedUntil.getTime() > Date.now();

    return {
      id: conversation.id,
      type: conversation.type,
      title:
        conversation.type === ConversationType.SAVED
          ? 'Saved Messages'
          : (conversation.title ??
            peer?.displayName ??
            peer?.username ??
            'Conversation'),
      peer: peer ? redact(peer) : null,
      members: conversation.members.map((member) => redact(member.user)),
      lastMessage: lastMessage
        ? this.mapMessage(lastMessage, currentUserId, ctx)
        : null,
      lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
      unreadCount,
      isArchived: memberState.isArchived ?? false,
      isPinned: memberState.isPinned ?? false,
      pinOrder: memberState.pinOrder ?? null,
      mutedUntil: isMuted ? mutedUntil!.toISOString() : null,
      isMuted,
      markedUnread: memberState.markedUnread ?? false,
      draft: memberState.draft ?? null,
      memberCount: conversation.members.length,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }

  mapMessage(
    message: {
      id: string;
      conversationId: string;
      senderId: string;
      content: string;
      status: MessageStatus;
      type?: MessageType;
      isPinned?: boolean;
      replyToId?: string | null;
      forwardedFromId?: string | null;
      fileUrl?: string | null;
      fileName?: string | null;
      fileSize?: number | null;
      mimeType?: string | null;
      durationMs?: number | null;
      editedAt?: Date | null;
      deletedAt?: Date | null;
      createdAt: Date;
      updatedAt: Date;
      sender: {
        id: string;
        username: string;
        displayName: string;
        avatarUrl: string | null;
        createdAt: Date;
        updatedAt: Date;
        email?: string;
      };
      replyTo?: {
        id: string;
        content: string;
        senderId: string;
        sender: { id: string; displayName: string; username: string };
      } | null;
      forwardedFrom?: {
        id: string;
        content: string;
        sender: { id: string; displayName: string; username: string };
      } | null;
      reactions?: Array<{ emoji: string; userId: string }>;
    },
    viewerId?: string,
    privacyContext?: {
      contacts: Set<string>;
      privacyMap: Map<
        string,
        Record<string, import('../user/privacy.constants').PrivacyVisibility>
      >;
    },
  ) {
    const deleted = Boolean(message.deletedAt);
    const reactionMap = new Map<
      string,
      { emoji: string; count: number; reactedByMe: boolean }
    >();

    for (const reaction of message.reactions ?? []) {
      const current = reactionMap.get(reaction.emoji) ?? {
        emoji: reaction.emoji,
        count: 0,
        reactedByMe: false,
      };
      current.count += 1;
      if (viewerId && reaction.userId === viewerId) {
        current.reactedByMe = true;
      }
      reactionMap.set(reaction.emoji, current);
    }

    const sender =
      viewerId && privacyContext
        ? this.userService.redactPeerUser(viewerId, message.sender, {
            contacts: privacyContext.contacts,
            privacyMap: privacyContext.privacyMap,
          })
        : {
            id: message.sender.id,
            username: message.sender.username,
            displayName: message.sender.displayName,
            avatarUrl: message.sender.avatarUrl,
            createdAt:
              message.sender.createdAt instanceof Date
                ? message.sender.createdAt.toISOString()
                : message.sender.createdAt,
            updatedAt:
              message.sender.updatedAt instanceof Date
                ? message.sender.updatedAt.toISOString()
                : message.sender.updatedAt,
          };

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      type: message.type ?? MessageType.TEXT,
      content: deleted ? '' : message.content,
      status: message.status,
      isPinned: deleted ? false : Boolean(message.isPinned),
      replyToId: message.replyToId ?? null,
      forwardedFromId: message.forwardedFromId ?? null,
      fileUrl: deleted ? null : (message.fileUrl ?? null),
      fileName: deleted ? null : (message.fileName ?? null),
      fileSize: deleted ? null : (message.fileSize ?? null),
      mimeType: deleted ? null : (message.mimeType ?? null),
      durationMs: deleted ? null : (message.durationMs ?? null),
      editedAt: message.editedAt?.toISOString() ?? null,
      deletedAt: message.deletedAt?.toISOString() ?? null,
      reactions: deleted ? [] : Array.from(reactionMap.values()),
      replyTo:
        !deleted && message.replyTo
          ? {
              id: message.replyTo.id,
              content: message.replyTo.content,
              senderId: message.replyTo.senderId,
              senderName:
                message.replyTo.sender.displayName ||
                message.replyTo.sender.username,
            }
          : null,
      forwardedFrom:
        !deleted && message.forwardedFrom
          ? {
              id: message.forwardedFrom.id,
              content: message.forwardedFrom.content,
              senderName:
                message.forwardedFrom.sender.displayName ||
                message.forwardedFrom.sender.username,
            }
          : null,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
      sender,
    };
  }
}
