import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConversationType, MessageStatus, MessageType } from '@prisma/client';

import { PrismaService } from '../../../database/prisma.service';
import { BlockService } from '../../user/services/block.service';
import { PrivacyService } from '../../user/services/privacy.service';
import { messageInclude } from '../constants/chat-selects';

import { ChatMapperService } from './chat-mapper.service';

@Injectable()
export class MessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly privacyService: PrivacyService,
    private readonly blockService: BlockService,
    private readonly mapper: ChatMapperService,
  ) {}

  async getMessages(
    userId: string,
    conversationId: string,
    cursor?: string,
    take = 40,
  ) {
    await this.mapper.assertMembership(userId, conversationId);

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
    const privacyContext = await this.mapper.buildPrivacyContext(
      userId,
      items.map((message) => message.senderId),
    );

    return {
      items: items
        .reverse()
        .map((message) =>
          this.mapper.mapMessage(message, userId, privacyContext),
        ),
      nextCursor: hasMore ? items[0]?.id : null,
    };
  }

  async getPinnedMessages(userId: string, conversationId: string) {
    await this.mapper.assertMembership(userId, conversationId);

    const messages = await this.prisma.message.findMany({
      where: { conversationId, isPinned: true },
      include: messageInclude,
      orderBy: { updatedAt: 'desc' },
    });

    return messages.map((message) => this.mapper.mapMessage(message, userId));
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
    await this.mapper.assertMembership(userId, conversationId);

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
      const peerId = conversation.members.find(
        (m) => m.userId !== userId,
      )?.userId;
      if (peerId) {
        await this.blockService.assertNotBlocked(userId, peerId);
        await this.privacyService.assertCanMessage(userId, peerId);
        if ((media?.type ?? MessageType.TEXT) === MessageType.VOICE) {
          await this.privacyService.assertCanSendVoice(userId, peerId);
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

    return this.mapper.mapMessage(message, userId);
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

    await this.mapper.assertMembership(userId, source.conversationId);
    await this.mapper.assertMembership(userId, targetConversationId);
    await this.privacyService.assertCanForwardFrom(userId, source.senderId);

    return this.createMessage(
      userId,
      targetConversationId,
      source.content,
      undefined,
      {
        type: source.type,
        fileUrl: source.fileUrl ?? undefined,
        fileName: source.fileName ?? undefined,
        fileSize: source.fileSize ?? undefined,
        mimeType: source.mimeType ?? undefined,
        durationMs: source.durationMs ?? undefined,
        forwardedFromId: source.id,
      },
    );
  }

  async togglePin(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.mapper.assertMembership(userId, message.conversationId);

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { isPinned: !message.isPinned },
      include: messageInclude,
    });

    return this.mapper.mapMessage(updated);
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

    await this.mapper.assertMembership(userId, message.conversationId);

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        content: trimmed,
        editedAt: new Date(),
      },
      include: messageInclude,
    });

    return this.mapper.mapMessage(updated);
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
      return this.mapper.mapMessage(
        await this.prisma.message.findUniqueOrThrow({
          where: { id: messageId },
          include: messageInclude,
        }),
      );
    }

    await this.mapper.assertMembership(userId, message.conversationId);

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

    return this.mapper.mapMessage(updated);
  }

  async markDelivered(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: messageInclude,
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.mapper.assertMembership(userId, message.conversationId);

    if (message.senderId === userId || message.status !== MessageStatus.SENT) {
      return this.mapper.mapMessage(message);
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { status: MessageStatus.DELIVERED },
      include: messageInclude,
    });
    return this.mapper.mapMessage(updated);
  }

  async markConversationSeen(userId: string, conversationId: string) {
    await this.mapper.assertMembership(userId, conversationId);

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
}
