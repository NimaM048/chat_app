import { Prisma } from '@prisma/client';

export const memberUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const messageInclude = {
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
