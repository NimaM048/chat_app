import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service';
import { messageInclude } from '../constants/chat-selects';

import { ChatMapperService } from './chat-mapper.service';

@Injectable()
export class ReactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: ChatMapperService,
  ) {}

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

    await this.mapper.assertMembership(userId, message.conversationId);

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

    return this.mapper.mapMessage(updated, userId);
  }
}
