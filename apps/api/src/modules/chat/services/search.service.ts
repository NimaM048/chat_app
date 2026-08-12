import { Injectable } from '@nestjs/common';
import { ConversationType } from '@prisma/client';

import { PrismaService } from '../../../database/prisma.service';
import { BlockService } from '../../user/services/block.service';
import { PrivacyService } from '../../user/services/privacy.service';
import { memberUserSelect, messageInclude } from '../constants/chat-selects';

import { ChatMapperService } from './chat-mapper.service';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly privacyService: PrivacyService,
    private readonly blockService: BlockService,
    private readonly mapper: ChatMapperService,
  ) {}

  async searchUsers(userId: string, query: string) {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [];
    }

    const blockedIds = await this.blockService.getBlockedPeerIds(userId);
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

    const privacyContext = await this.mapper.buildPrivacyContext(
      userId,
      users.map((user) => user.id),
    );

    return users.map((user) =>
      this.privacyService.redactPeerUser(userId, user, {
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
        return this.mapper.mapConversation(
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
          ...this.mapper.mapMessage(message, userId),
          conversationTitle: title,
        };
      }),
    };
  }
}
