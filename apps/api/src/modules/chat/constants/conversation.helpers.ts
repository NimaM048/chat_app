import { ConversationType } from '@prisma/client';

import { memberUserSelect, messageInclude } from './chat-selects';

export const conversationDetailInclude = {
  members: {
    include: { user: { select: memberUserSelect } },
  },
  messages: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    include: messageInclude,
  },
} as const;

export function sortConversations<
  T extends {
    type: ConversationType;
    isPinned: boolean;
    pinOrder: number | null;
    lastMessageAt: string | null;
  },
>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (
      a.type === ConversationType.SAVED &&
      b.type !== ConversationType.SAVED
    ) {
      return -1;
    }
    if (
      b.type === ConversationType.SAVED &&
      a.type !== ConversationType.SAVED
    ) {
      return 1;
    }
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }
    if (a.isPinned && b.isPinned) {
      return (a.pinOrder ?? 0) - (b.pinOrder ?? 0);
    }
    const aTime = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
    const bTime = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
    return bTime - aTime;
  });
}
