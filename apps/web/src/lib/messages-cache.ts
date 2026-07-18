import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { ChatMessage, MessagesPage } from '@/types/chat'

export type MessagesInfiniteData = InfiniteData<MessagesPage, string | undefined>

export function messagesQueryKey(conversationId: string) {
  return ['messages', conversationId] as const
}

/** pages[0] = newest batch; later pages = older. Display oldest→newest. */
export function flattenMessagePages(
  data: MessagesInfiniteData | undefined,
): ChatMessage[] {
  if (!data?.pages?.length) return []
  const byId = new Map<string, ChatMessage>()
  for (let i = data.pages.length - 1; i >= 0; i -= 1) {
    for (const message of data.pages[i].items) {
      byId.set(message.id, message)
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  )
}

function sortPageItems(items: ChatMessage[]) {
  return [...items].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  )
}

export function upsertMessageInInfinite(
  data: MessagesInfiniteData | undefined,
  message: ChatMessage,
): MessagesInfiniteData {
  const base: MessagesInfiniteData = data ?? {
    pages: [{ items: [], nextCursor: null }],
    pageParams: [undefined],
  }

  let foundPage = -1
  const pages = base.pages.map((page, pageIndex) => {
    const withoutOptimistic = page.items.filter(
      (item) =>
        !(
          item.optimistic &&
          item.content === message.content &&
          item.senderId === message.senderId
        ),
    )
    const existingIndex = withoutOptimistic.findIndex(
      (item) => item.id === message.id,
    )
    if (existingIndex >= 0) {
      foundPage = pageIndex
      const next = [...withoutOptimistic]
      next[existingIndex] = message
      return { ...page, items: sortPageItems(next) }
    }
    return { ...page, items: withoutOptimistic }
  })

  if (foundPage < 0) {
    const first = pages[0] ?? { items: [], nextCursor: null }
    pages[0] = {
      ...first,
      items: sortPageItems([...first.items, message]),
    }
  }

  return { ...base, pages }
}

export function patchMessageInInfinite(
  data: MessagesInfiniteData | undefined,
  messageId: string,
  patch: Partial<ChatMessage> | ((msg: ChatMessage) => ChatMessage),
): MessagesInfiniteData | undefined {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((item) => {
        if (item.id !== messageId) return item
        return typeof patch === 'function' ? patch(item) : { ...item, ...patch }
      }),
    })),
  }
}

export function replaceOrAppendMessage(
  data: MessagesInfiniteData | undefined,
  optimisticId: string,
  saved: ChatMessage,
): MessagesInfiniteData {
  const base = data ?? {
    pages: [{ items: [], nextCursor: null }],
    pageParams: [undefined],
  }
  let replaced = false
  const pages = base.pages.map((page) => ({
    ...page,
    items: sortPageItems(
      page.items.map((item) => {
        if (item.id === optimisticId || item.id === saved.id) {
          replaced = true
          return saved
        }
        return item
      }),
    ),
  }))
  if (!replaced) {
    const first = pages[0] ?? { items: [], nextCursor: null }
    pages[0] = {
      ...first,
      items: sortPageItems([
        ...first.items.filter((item) => item.id !== optimisticId),
        saved,
      ]),
    }
  }
  return { ...base, pages }
}

export function removeOptimistic(
  data: MessagesInfiniteData | undefined,
  optimisticId: string,
): MessagesInfiniteData | undefined {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((item) => item.id !== optimisticId),
    })),
  }
}

export function setMessagesInfinite(
  queryClient: QueryClient,
  conversationId: string,
  updater: (
    current: MessagesInfiniteData | undefined,
  ) => MessagesInfiniteData | undefined,
) {
  queryClient.setQueryData<MessagesInfiniteData>(
    messagesQueryKey(conversationId),
    updater,
  )
}
