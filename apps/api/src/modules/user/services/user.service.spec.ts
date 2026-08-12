import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConversationType } from '@prisma/client';

import { PrismaService } from '../../../database/prisma.service';

import { BlockService } from './block.service';
import { PrivacyService } from './privacy.service';
import { UserService } from './user.service';

describe('User privacy and blocks', () => {
  let privacyService: PrivacyService;
  let blockService: BlockService;
  let userService: UserService;

  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    userBlock: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    privacySetting: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      createMany: jest.fn(),
    },
    conversation: {
      findFirst: jest.fn(),
    },
    conversationMember: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    userPreference: {
      findUnique: jest.fn(),
    },
    refreshToken: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        BlockService,
        PrivacyService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    userService = module.get(UserService);
    blockService = module.get(BlockService);
    privacyService = module.get(PrivacyService);
    jest.clearAllMocks();
  });

  it('detects mutual blocks', async () => {
    prisma.userBlock.findFirst.mockResolvedValue({ id: 'b1' });
    await expect(blockService.areBlocked('a', 'b')).resolves.toBe(true);
    await expect(
      blockService.assertNotBlocked('a', 'b'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('treats shared DIRECT chats as contacts', async () => {
    prisma.conversation.findFirst.mockResolvedValue({ id: 'c1' });
    await expect(privacyService.isContact('a', 'b')).resolves.toBe(true);
    expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: ConversationType.DIRECT }),
      }),
    );
  });

  it('enforces NOBODY privacy for messages', async () => {
    prisma.userBlock.findFirst.mockResolvedValue(null);
    prisma.privacySetting.findUnique.mockResolvedValue({
      visibility: 'NOBODY',
    });
    await expect(
      privacyService.assertCanMessage('a', 'b'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('redacts avatar when PROFILE_PHOTO is NOBODY', () => {
    const privacyMap = new Map([
      [
        'target',
        {
          PROFILE_PHOTO: 'NOBODY' as const,
          BIO: 'EVERYONE' as const,
          LAST_SEEN: 'EVERYONE' as const,
        },
      ],
    ]);
    const view = privacyService.redactPeerUser(
      'viewer',
      {
        id: 'target',
        username: 'bob',
        displayName: 'Bob',
        avatarUrl: '/a.png',
        bio: 'hi',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
      {
        contacts: new Set(),
        privacyMap,
        includeBio: true,
      },
    );
    expect(view.avatarUrl).toBeNull();
    expect(view.bio).toBe('hi');
  });

  it('rejects delete account with wrong password', async () => {
    const argon2 = await import('argon2');
    const password = await argon2.hash('correct-password');
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      password,
    });

    await expect(
      userService.deleteAccount('u1', { password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('deletes account after password verification', async () => {
    const argon2 = await import('argon2');
    const password = await argon2.hash('correct-password');
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      password,
    });
    prisma.$transaction.mockResolvedValue([{}, {}]);

    await userService.deleteAccount('u1', { password: 'correct-password' });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('blocks forwards when FORWARDS is NOBODY', async () => {
    prisma.privacySetting.findUnique.mockResolvedValue({
      visibility: 'NOBODY',
    });
    await expect(
      privacyService.assertCanForwardFrom('a', 'b'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
