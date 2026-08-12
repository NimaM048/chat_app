import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../database/prisma.service';

import { ChatMapperService } from './chat-mapper.service';

@Injectable()
export class DraftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: ChatMapperService,
  ) {}

  async upsertDraft(
    userId: string,
    conversationId: string,
    content: string,
    replyToId?: string | null,
  ) {
    await this.mapper.assertMembership(userId, conversationId);
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
    await this.mapper.assertMembership(userId, conversationId);
    await this.prisma.draft.deleteMany({
      where: { userId, conversationId },
    });
    return {
      conversationId,
      content: null,
      updatedAt: null,
    };
  }
}
