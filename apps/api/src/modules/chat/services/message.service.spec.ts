import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConversationType, MessageStatus, MessageType } from '@prisma/client';

import { PrismaService } from '../../../database/prisma.service';
import { BlockService } from '../../user/services/block.service';
import { PrivacyService } from '../../user/services/privacy.service';

import { ChatMapperService } from './chat-mapper.service';
import { MessageService } from './message.service';

describe('MessageService', () => {
  let service: MessageService;

  const prisma = {
    conversationMember: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    conversation: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    message: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    draft: {
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const privacyService = {
    assertCanMessage: jest.fn(),
    assertCanSendVoice: jest.fn(),
    assertCanForwardFrom: jest.fn(),
    getContactIds: jest.fn().mockResolvedValue(new Set()),
    getPrivacyMapForUsers: jest.fn().mockResolvedValue(new Map()),
    redactPeerUser: jest.fn((_: string, user: { id: string }) => user),
  };

  const blockService = {
    assertNotBlocked: jest.fn(),
    getBlockedPeerIds: jest.fn().mockResolvedValue(new Set()),
  };

  const mapper = {
    assertMembership: jest.fn(),
    buildPrivacyContext: jest.fn().mockResolvedValue({
      contacts: new Set(),
      privacyMap: new Map(),
    }),
    mapMessage: jest.fn((message: { content: string; type?: string }) => ({
      ...message,
      content: message.content,
      type: message.type ?? 'TEXT',
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        { provide: PrismaService, useValue: prisma },
        { provide: PrivacyService, useValue: privacyService },
        { provide: BlockService, useValue: blockService },
        { provide: ChatMapperService, useValue: mapper },
      ],
    }).compile();

    service = module.get(MessageService);
    jest.clearAllMocks();
    mapper.assertMembership.mockResolvedValue({
      id: 'm1',
      userId: 'u1',
      conversationId: 'c1',
    });
  });

  it('creates a text message for conversation members', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'c1',
      type: ConversationType.GROUP,
      members: [{ userId: 'u1' }, { userId: 'u2' }],
    });

    const created = {
      id: 'msg1',
      conversationId: 'c1',
      senderId: 'u1',
      content: 'hello',
      type: MessageType.TEXT,
      status: MessageStatus.SENT,
      createdAt: new Date(),
      updatedAt: new Date(),
      sender: { id: 'u1', username: 'alice', displayName: 'Alice' },
    };

    prisma.$transaction.mockImplementation(
      (cb: (tx: typeof prisma) => unknown) =>
        Promise.resolve(
          cb({
            ...prisma,
            message: {
              ...prisma.message,
              create: jest.fn().mockResolvedValue(created),
            },
            conversation: {
              ...prisma.conversation,
              update: jest.fn().mockResolvedValue({}),
            },
            conversationMember: {
              ...prisma.conversationMember,
              update: jest.fn().mockResolvedValue({}),
            },
          }),
        ),
    );

    const result = await service.createMessage('u1', 'c1', 'hello');
    expect(result.content).toBe('hello');
    expect(result.type).toBe('TEXT');
  });

  it('rejects non-members', async () => {
    mapper.assertMembership.mockRejectedValue(
      new ForbiddenException('not a member'),
    );

    await expect(
      service.createMessage('u1', 'c1', 'nope'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws when reply target is missing', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'c1',
      type: ConversationType.GROUP,
      members: [{ userId: 'u1' }],
    });
    prisma.message.findFirst.mockResolvedValue(null);

    await expect(
      service.createMessage('u1', 'c1', 'reply', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks direct messages when block helper rejects', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'c1',
      type: ConversationType.DIRECT,
      members: [{ userId: 'u1' }, { userId: 'u2' }],
    });
    blockService.assertNotBlocked.mockRejectedValue(
      new ForbiddenException('blocked'),
    );

    await expect(
      service.createMessage('u1', 'c1', 'hello'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('checks forward privacy before forwarding', async () => {
    prisma.message.findUnique.mockResolvedValue({
      id: 'm1',
      conversationId: 'c1',
      senderId: 'author',
      content: 'secret',
      sender: { id: 'author', displayName: 'A', username: 'a' },
    });
    privacyService.assertCanForwardFrom.mockRejectedValue(
      new ForbiddenException('no forwards'),
    );

    await expect(
      service.forwardMessage('u1', 'm1', 'c2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
