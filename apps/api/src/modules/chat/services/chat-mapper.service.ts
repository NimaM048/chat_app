import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConversationType, MessageStatus, MessageType } from '@prisma/client';

import { PrismaService } from '../../../database/prisma.service';
import { PrivacyVisibility } from '../../user/constants/privacy.constants';
import { PrivacyService } from '../../user/services/privacy.service';

type PrivacyContext = {
  contacts: Set<string>;
  privacyMap: Map<string, Record<string, PrivacyVisibility>>;
};

@Injectable()
export class ChatMapperService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly privacyService: PrivacyService,
  ) {}

  async buildPrivacyContext(
    viewerId: string,
    userIds: string[],
  ): Promise<PrivacyContext> {
    const [contacts, privacyMap] = await Promise.all([
      this.privacyService.getContactIds(viewerId),
      this.privacyService.getPrivacyMapForUsers(userIds),
    ]);
    return { contacts, privacyMap };
  }

  async assertMembership(userId: string, conversationId: string) {
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

  async mapConversation(
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
    lastMessage: Parameters<ChatMapperService['mapMessage']>[0] | null,
    unreadCount: number,
    memberState: {
      isArchived?: boolean;
      isPinned?: boolean;
      pinOrder?: number | null;
      mutedUntil?: Date | null;
      markedUnread?: boolean;
      draft?: string | null;
    } = {},
    privacyContext?: PrivacyContext,
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
      this.privacyService.redactPeerUser(currentUserId, user, {
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
    const isMuted = mutedUntil !== null && mutedUntil.getTime() > Date.now();

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
      mutedUntil: isMuted ? mutedUntil.toISOString() : null,
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
    privacyContext?: PrivacyContext,
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
        ? this.privacyService.redactPeerUser(viewerId, message.sender, {
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
