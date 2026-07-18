import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConversationType, MessageStatus, MessageType } from '@prisma/client';
import { ChatService } from './chat.service';
import { PrismaService } from '../database/prisma.service';
import { UserService } from '../user/user.service';

describe('ChatService', () => {
  let service: ChatService;

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
    user: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const userService = {
    findByUsername: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    assertCanMessage: jest.fn(),
    assertNotBlocked: jest.fn(),
    assertCanSendVoice: jest.fn(),
    assertCanAddToGroup: jest.fn(),
    assertCanForwardFrom: jest.fn(),
    getBlockedPeerIds: jest.fn().mockResolvedValue(new Set()),
    getContactIds: jest.fn().mockResolvedValue(new Set()),
    getPrivacyMapForUsers: jest.fn().mockResolvedValue(new Map()),
    redactPeerUser: jest.fn((_: string, user: { id: string }) => user),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: UserService, useValue: userService },
      ],
    }).compile();

    service = module.get(ChatService);
    jest.clearAllMocks();
    userService.getBlockedPeerIds.mockResolvedValue(new Set());
    userService.getContactIds.mockResolvedValue(new Set());
    userService.getPrivacyMapForUsers.mockResolvedValue(new Map());
    userService.redactPeerUser.mockImplementation(
      (_: string, user: { id: string }) => user,
    );
  });

  it('creates a text message for conversation members', async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({
      id: 'm1',
      userId: 'u1',
      conversationId: 'c1',
    });
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
      isPinned: false,
      replyToId: null,
      forwardedFromId: null,
      fileUrl: null,
      fileName: null,
      fileSize: null,
      mimeType: null,
      durationMs: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      sender: {
        id: 'u1',
        username: 'alice',
        displayName: 'Alice',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      replyTo: null,
      forwardedFrom: null,
    };

    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => unknown) =>
      cb({
        ...prisma,
        message: { ...prisma.message, create: jest.fn().mockResolvedValue(created) },
        conversation: {
          ...prisma.conversation,
          update: jest.fn().mockResolvedValue({}),
        },
        conversationMember: {
          ...prisma.conversationMember,
          update: jest.fn().mockResolvedValue({}),
        },
      }),
    );

    const result = await service.createMessage('u1', 'c1', 'hello');
    expect(result.content).toBe('hello');
    expect(result.type).toBe('TEXT');
  });

  it('rejects non-members', async () => {
    prisma.conversationMember.findUnique.mockResolvedValue(null);

    await expect(service.createMessage('u1', 'c1', 'nope')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws when reply target is missing', async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({
      id: 'm1',
      userId: 'u1',
      conversationId: 'c1',
    });
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

  it('blocks direct messages when privacy/block helpers reject', async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({
      id: 'm1',
      userId: 'u1',
      conversationId: 'c1',
    });
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'c1',
      type: ConversationType.DIRECT,
      members: [{ userId: 'u1' }, { userId: 'u2' }],
    });
    userService.assertNotBlocked.mockRejectedValue(
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
    prisma.conversationMember.findUnique.mockResolvedValue({
      id: 'mem',
      userId: 'u1',
      conversationId: 'c1',
    });
    userService.assertCanForwardFrom.mockRejectedValue(
      new ForbiddenException('no forwards'),
    );

    await expect(
      service.forwardMessage('u1', 'm1', 'c2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('forwards image media fields in one create', async () => {
    prisma.message.findUnique.mockResolvedValue({
      id: 'm1',
      conversationId: 'c1',
      senderId: 'author',
      content: '',
      type: MessageType.IMAGE,
      fileUrl: '/uploads/photo.jpg',
      fileName: 'photo.jpg',
      fileSize: 1200,
      mimeType: 'image/jpeg',
      durationMs: null,
      sender: { id: 'author', displayName: 'A', username: 'a' },
    });
    prisma.conversationMember.findUnique.mockResolvedValue({
      id: 'mem',
      userId: 'u1',
      conversationId: 'c1',
    });
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'c2',
      type: ConversationType.GROUP,
      members: [{ userId: 'u1' }, { userId: 'u2' }],
    });
    userService.assertCanForwardFrom.mockResolvedValue(undefined);

    const created = {
      id: 'fwd1',
      conversationId: 'c2',
      senderId: 'u1',
      content: '',
      type: MessageType.IMAGE,
      status: MessageStatus.SENT,
      isPinned: false,
      replyToId: null,
      forwardedFromId: 'm1',
      fileUrl: '/uploads/photo.jpg',
      fileName: 'photo.jpg',
      fileSize: 1200,
      mimeType: 'image/jpeg',
      durationMs: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      sender: {
        id: 'u1',
        username: 'alice',
        displayName: 'Alice',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      replyTo: null,
      forwardedFrom: {
        id: 'm1',
        content: '',
        type: MessageType.IMAGE,
        sender: { id: 'author', displayName: 'A', username: 'a' },
      },
    };

    const createMock = jest.fn().mockResolvedValue(created);
    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => unknown) =>
      cb({
        ...prisma,
        message: { ...prisma.message, create: createMock },
        conversation: {
          ...prisma.conversation,
          update: jest.fn().mockResolvedValue({}),
        },
        conversationMember: {
          ...prisma.conversationMember,
          update: jest.fn().mockResolvedValue({}),
        },
      }),
    );

    const result = await service.forwardMessage('u1', 'm1', 'c2');
    expect(result.type).toBe(MessageType.IMAGE);
    expect(result.fileUrl).toBe('/uploads/photo.jpg');
    expect(result.fileName).toBe('photo.jpg');
    expect(result.forwardedFromId).toBe('m1');
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: MessageType.IMAGE,
          fileUrl: '/uploads/photo.jpg',
          fileName: 'photo.jpg',
          fileSize: 1200,
          mimeType: 'image/jpeg',
          forwardedFromId: 'm1',
        }),
      }),
    );
    expect(prisma.message.update).not.toHaveBeenCalled();
  });

  it('creates voice messages via media payload (WS parity path)', async () => {
    prisma.conversationMember.findUnique.mockResolvedValue({
      id: 'm1',
      userId: 'u1',
      conversationId: 'c1',
    });
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'c1',
      type: ConversationType.GROUP,
      members: [{ userId: 'u1' }, { userId: 'u2' }],
    });

    const created = {
      id: 'voice1',
      conversationId: 'c1',
      senderId: 'u1',
      content: '',
      type: MessageType.VOICE,
      status: MessageStatus.SENT,
      isPinned: false,
      replyToId: null,
      forwardedFromId: null,
      fileUrl: '/uploads/voice.webm',
      fileName: 'voice.webm',
      fileSize: 4000,
      mimeType: 'audio/webm',
      durationMs: 1500,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      sender: {
        id: 'u1',
        username: 'alice',
        displayName: 'Alice',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      replyTo: null,
      forwardedFrom: null,
    };

    const createMock = jest.fn().mockResolvedValue(created);
    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => unknown) =>
      cb({
        ...prisma,
        message: { ...prisma.message, create: createMock },
        conversation: {
          ...prisma.conversation,
          update: jest.fn().mockResolvedValue({}),
        },
        conversationMember: {
          ...prisma.conversationMember,
          update: jest.fn().mockResolvedValue({}),
        },
      }),
    );

    const result = await service.createMessage('u1', 'c1', '', undefined, {
      type: MessageType.VOICE,
      fileUrl: '/uploads/voice.webm',
      fileName: 'voice.webm',
      fileSize: 4000,
      mimeType: 'audio/webm',
      durationMs: 1500,
    });

    expect(result.type).toBe(MessageType.VOICE);
    expect(result.fileUrl).toBe('/uploads/voice.webm');
    expect(result.durationMs).toBe(1500);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: MessageType.VOICE,
          fileUrl: '/uploads/voice.webm',
          durationMs: 1500,
        }),
      }),
    );
  });

  it('rejects direct conversation when messaging is forbidden', async () => {
    userService.findByUsername.mockResolvedValue({
      id: 'u2',
      username: 'bob',
    });
    userService.assertCanMessage.mockRejectedValue(
      new ForbiddenException('no messages'),
    );

    await expect(
      service.createDirectConversation('u1', 'bob'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
