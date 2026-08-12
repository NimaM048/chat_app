import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';

import { PrismaService } from '../../../database/prisma.service';
import { RateLimitService } from '../../rate-limit/rate-limit.service';
import { UserService } from '../../user/services/user.service';

import { AuthService } from './auth.service';
import { SessionService } from './session.service';

jest.mock('argon2');

describe('AuthService', () => {
  let service: AuthService;

  const mockUser = {
    id: 'user-id',
    email: 'sara@example.com',
    username: 'sara_dev',
    password: 'hashed-password',
    displayName: 'Sara Developer',
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const userService = {
    findByEmail: jest.fn(),
    findByUsername: jest.fn(),
    createUser: jest.fn(),
    getSafeUserById: jest.fn(),
  };

  const prisma = {
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const configService = {
    get: jest.fn((key: string, fallback?: string) => {
      const values: Record<string, string> = {
        JWT_ACCESS_SECRET: 'access-secret',
        JWT_REFRESH_SECRET: 'refresh-secret',
        JWT_ACCESS_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
      };

      return values[key] ?? fallback;
    }),
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, string> = {
        JWT_ACCESS_SECRET: 'access-secret',
        JWT_REFRESH_SECRET: 'refresh-secret',
      };

      return values[key];
    }),
  };

  const rateLimitService = {
    consume: jest.fn().mockResolvedValue({ allowed: true, remaining: 9 }),
  };

  const sessionService = {
    listSessions: jest.fn(),
    revokeSession: jest.fn(),
    revokeOtherSessions: jest.fn(),
    touchSession: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userService },
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: RateLimitService, useValue: rateLimitService },
        { provide: SessionService, useValue: sessionService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('registers a new user and returns tokens', async () => {
    userService.findByEmail.mockResolvedValue(null);
    userService.findByUsername.mockResolvedValue(null);
    (argon2.hash as jest.Mock).mockResolvedValue('hashed-password');
    userService.createUser.mockResolvedValue({
      ...mockUser,
      password: undefined,
    });
    jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    prisma.refreshToken.create.mockResolvedValue({});

    const result = await service.register(
      {
        email: 'sara@example.com',
        username: 'sara_dev',
        displayName: 'Sara Developer',
        password: 'StrongPass123!',
      },
      '127.0.0.1',
    );

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.sessionId).toBeTruthy();
    expect(result.user.email).toBe('sara@example.com');
  });

  it('throws when email already exists', async () => {
    userService.findByEmail.mockResolvedValue(mockUser);
    userService.findByUsername.mockResolvedValue(null);

    await expect(
      service.register(
        {
          email: 'sara@example.com',
          username: 'sara_dev',
          displayName: 'Sara Developer',
          password: 'StrongPass123!',
        },
        '127.0.0.1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with valid credentials', async () => {
    userService.findByEmail.mockResolvedValue(mockUser);
    (argon2.verify as jest.Mock).mockResolvedValue(true);
    jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    prisma.refreshToken.create.mockResolvedValue({});

    const result = await service.login(
      {
        identifier: 'sara@example.com',
        password: 'StrongPass123!',
      },
      '127.0.0.1',
    );

    expect(result.user.username).toBe('sara_dev');
    expect(result.accessToken).toBe('access-token');
    expect(result.sessionId).toBeTruthy();
  });

  it('rejects invalid credentials', async () => {
    userService.findByEmail.mockResolvedValue(null);
    userService.findByUsername.mockResolvedValue(null);

    await expect(
      service.login(
        {
          identifier: 'missing@example.com',
          password: 'StrongPass123!',
        },
        '127.0.0.1',
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
