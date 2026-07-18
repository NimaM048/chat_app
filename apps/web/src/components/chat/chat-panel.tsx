import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  ArrowLeft,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Forward,
  MoreVertical,
  Pin,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ChatInfoSheet } from '@/components/chat/chat-info-sheet'
import { MessageComposer } from '@/components/chat/message-composer'
import { MessageList } from '@/components/chat/message-list'
import { TypingIndicator } from '@/components/chat/typing-indicator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/ui/user-avatar'
import type { useChatSocket } from '@/hooks/use-chat-socket'
import { api } from '@/lib/api'
import { MUTE_FOREVER_ISO } from '@/lib/device'
import { formatLastSeen } from '@/lib/format'
import {
  flattenMessagePages,
  messagesQueryKey,
  removeOptimistic,
  replaceOrAppendMessage,
  setMessagesInfinite,
  upsertMessageInInfinite,
  type MessagesInfiniteData,
} from '@/lib/messages-cache'
import { useAuthStore } from '@/stores/auth-store'
import { useChatUiStore } from '@/stores/chat-ui-store'
import type { ChatMessage, Conversation, MessagesPage } from '@/types/chat'

interface ChatPanelProps {
  conversation: Conversation
  conversations: Conversation[]
  socketApi: ReturnType<typeof useChatSocket>
  onBack: () => void
}

export function ChatPanel({
  conversation,
  conversations,
  socketApi,
  onBack,
}: ChatPanelProps) {
  const accessToken = useAuthStore((state) => state.accessToken)
  const currentUser = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [editing, setEditing] = useState<ChatMessage | null>(null)
  const [forwardMessage, setForwardMessage] = useState<ChatMessage | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  const [infoOpen, setInfoOpen] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchForwardOpen, setBatchForwardOpen] = useState(false)

  const draft = useChatUiStore(
    (state) => state.draftsByConversation[conversation.id] ?? '',
  )
  const setDraft = useChatUiStore((state) => state.setDraft)
  const clearDraft = useChatUiStore((state) => state.clearDraft)
  const setMuted = useChatUiStore((state) => state.setMuted)
  const muted = useChatUiStore((state) =>
    state.mutedConversationIds[conversation.id] !== undefined
      ? Boolean(state.mutedConversationIds[conversation.id])
      : Boolean(conversation.isMuted),
  )

  const muteMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken) throw new Error('Not authenticated')
      return api.updateConversation(accessToken, conversation.id, {
        mutedUntil: muted ? null : MUTE_FOREVER_ISO,
      })
    },
    onMutate: () => {
      setMuted(conversation.id, !muted)
    },
    onSuccess: (updated) => {
      setMuted(conversation.id, Boolean(updated.isMuted))
      queryClient.setQueryData<Conversation[]>(['conversations'], (current) => {
        if (!current) return current
        return current.map((item) =>
          item.id === updated.id ? { ...item, ...updated } : item,
        )
      })
    },
    onError: () => {
      setMuted(conversation.id, muted)
    },
  })

  useEffect(() => {
    if (!accessToken) return
    const handle = window.setTimeout(() => {
      void api
        .upsertDraft(accessToken, conversation.id, draft)
        .catch(() => undefined)
    }, 700)
    return () => window.clearTimeout(handle)
    // Intentionally sync whenever draft text changes for this conversation.
  }, [accessToken, conversation.id, draft])

  // Seed local draft from server field when opening a chat that has no local draft yet
  useEffect(() => {
    if (conversation.draft && !draft) {
      setDraft(conversation.id, conversation.draft)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when conversation changes
  }, [conversation.id])

  const typingUser = useChatUiStore(
    (state) => state.typingByConversation[conversation.id] ?? null,
  )
  const online = useChatUiStore((state) =>
    conversation.peer
      ? Boolean(state.onlineUserIds[conversation.peer.id])
      : false,
  )
  const peerLastSeen = useChatUiStore((state) =>
    conversation.peer
      ? state.lastSeenByUserId[conversation.peer.id] ??
        conversation.peer.lastSeenAt ??
        null
      : null,
  )

  const focusMessageId = useChatUiStore((state) => state.focusMessageId)
  const setFocusMessageId = useChatUiStore((state) => state.setFocusMessageId)

  const messagesQuery = useInfiniteQuery<
    MessagesPage,
    Error,
    MessagesInfiniteData,
    ReturnType<typeof messagesQueryKey>,
    string | undefined
  >({
    queryKey: messagesQueryKey(conversation.id),
    enabled: Boolean(accessToken),
    initialPageParam: undefined,
    queryFn: ({ pageParam }) =>
      api.getMessages(accessToken!, conversation.id, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const pinnedQuery = useQuery({
    queryKey: ['pinned', conversation.id],
    enabled: Boolean(accessToken),
    queryFn: () => api.getPinned(accessToken!, conversation.id),
  })

  useEffect(() => {
    setReplyTo(null)
    setEditing(null)
    setForwardMessage(null)
    setSendError(null)
    setSearchOpen(false)
    setSearchQuery('')
    setMatchIndex(0)
    setInfoOpen(false)
    setSelectionMode(false)
    setSelectedIds(new Set())
    setBatchForwardOpen(false)
    socketApi.joinConversation(conversation.id)
    socketApi.markSeen(conversation.id)
  }, [conversation.id, socketApi])

  const allMessages = useMemo(
    () => flattenMessagePages(messagesQuery.data),
    [messagesQuery.data],
  )

  useEffect(() => {
    for (const message of allMessages) {
      if (
        currentUser &&
        message.senderId !== currentUser.id &&
        message.status === 'SENT'
      ) {
        socketApi.markDelivered(message.id)
      }
    }
  }, [allMessages, currentUser, socketApi])

  // Deep-link: load older pages until focus message is found (max 10)
  useEffect(() => {
    if (!focusMessageId || !accessToken) return
    let cancelled = false

    async function ensureFocused() {
      let pagesLoaded = 0
      while (!cancelled && pagesLoaded < 10) {
        const data = queryClient.getQueryData<MessagesInfiniteData>(
          messagesQueryKey(conversation.id),
        )
        const flat = flattenMessagePages(data)
        if (flat.some((message) => message.id === focusMessageId)) {
          return
        }
        const lastPage = data?.pages.at(-1)
        if (!lastPage?.nextCursor) return
        await messagesQuery.fetchNextPage()
        pagesLoaded += 1
      }
    }

    void ensureFocused()
    return () => {
      cancelled = true
    }
  }, [
    focusMessageId,
    accessToken,
    conversation.id,
    queryClient,
    messagesQuery.fetchNextPage,
    messagesQuery.data?.pages.length,
  ])

  useEffect(() => {
    if (!focusMessageId) return
    if (!allMessages.some((message) => message.id === focusMessageId)) return
    const handle = window.setTimeout(() => {
      document
        .getElementById(`msg-${focusMessageId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      window.setTimeout(() => setFocusMessageId(null), 1600)
    }, 80)
    return () => window.clearTimeout(handle)
  }, [focusMessageId, allMessages, setFocusMessageId])

  const sendMutation = useMutation({
    mutationFn: async (payload: {
      content?: string
      type?: ChatMessage['type']
      fileUrl?: string
      fileName?: string
      fileSize?: number
      mimeType?: string
      durationMs?: number
    }) => {
      if (!accessToken || !currentUser) {
        throw new Error('Not authenticated')
      }

      const optimisticId = `temp-${crypto.randomUUID()}`
      const optimistic: ChatMessage = {
        id: optimisticId,
        conversationId: conversation.id,
        senderId: currentUser.id,
        type: payload.type ?? 'TEXT',
        content: payload.content ?? '',
        status: 'SENT',
        isPinned: false,
        replyToId: replyTo?.id ?? null,
        forwardedFromId: null,
        fileUrl: payload.fileUrl ?? null,
        fileName: payload.fileName ?? null,
        fileSize: payload.fileSize ?? null,
        mimeType: payload.mimeType ?? null,
        durationMs: payload.durationMs ?? null,
        editedAt: null,
        deletedAt: null,
        reactions: [],
        replyTo: replyTo
          ? {
              id: replyTo.id,
              content: replyTo.content,
              senderId: replyTo.senderId,
              senderName: replyTo.sender.displayName,
            }
          : null,
        forwardedFrom: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sender: {
          id: currentUser.id,
          email: currentUser.email,
          username: currentUser.username,
          displayName: currentUser.displayName,
          avatarUrl: currentUser.avatarUrl,
          createdAt: currentUser.createdAt,
          updatedAt: currentUser.updatedAt,
        },
        optimistic: true,
      }

      setMessagesInfinite(queryClient, conversation.id, (current) =>
        upsertMessageInInfinite(current, optimistic),
      )

      try {
        const saved = await api.sendMessage(accessToken, conversation.id, {
          ...payload,
          replyToId: replyTo?.id,
        })

        setMessagesInfinite(queryClient, conversation.id, (current) =>
          replaceOrAppendMessage(current, optimisticId, saved),
        )

        setReplyTo(null)
        clearDraft(conversation.id)
        setSendError(null)
        return saved
      } catch (error) {
        setMessagesInfinite(queryClient, conversation.id, (current) =>
          removeOptimistic(current, optimisticId),
        )
        throw error
      }
    },
    onError: (error: Error) => {
      setSendError(error.message || 'Failed to send message')
    },
  })

  async function sendMedia(file: File | Blob, fileName: string, durationMs?: number) {
    if (!accessToken) throw new Error('Not authenticated')
    const uploaded = await api.upload(accessToken, file, fileName)
    const isImage = uploaded.mimeType.startsWith('image/')
    const isVoice = uploaded.mimeType.startsWith('audio/') || Boolean(durationMs)
    await sendMutation.mutateAsync({
      content: '',
      type: isVoice ? 'VOICE' : isImage ? 'IMAGE' : 'FILE',
      fileUrl: uploaded.url,
      fileName: uploaded.fileName,
      fileSize: uploaded.fileSize,
      mimeType: uploaded.mimeType,
      durationMs,
    })
  }
  const pinMutation = useMutation({
    mutationFn: (message: ChatMessage) =>
      api.togglePin(accessToken!, message.id),
    onSuccess: (message) => {
      setMessagesInfinite(queryClient, conversation.id, (current) =>
        upsertMessageInInfinite(current, message),
      )
      void queryClient.invalidateQueries({ queryKey: ['pinned', conversation.id] })
    },
  })

  const forwardMutation = useMutation({
    mutationFn: (targetConversationId: string) =>
      api.forwardMessage(accessToken!, forwardMessage!.id, targetConversationId),
    onSuccess: () => {
      setForwardMessage(null)
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  const editMutation = useMutation({
    mutationFn: (content: string) =>
      api.editMessage(accessToken!, editing!.id, content),
    onSuccess: (message) => {
      setMessagesInfinite(queryClient, conversation.id, (current) =>
        upsertMessageInInfinite(current, message),
      )
      setEditing(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (message: ChatMessage) =>
      api.deleteMessage(accessToken!, message.id),
    onSuccess: (message) => {
      setMessagesInfinite(queryClient, conversation.id, (current) =>
        upsertMessageInInfinite(current, message),
      )
      void queryClient.invalidateQueries({ queryKey: ['pinned', conversation.id] })
      if (editing?.id === message.id) setEditing(null)
      if (replyTo?.id === message.id) setReplyTo(null)
    },
  })

  const reactMutation = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      api.reactMessage(accessToken!, messageId, emoji),
    onSuccess: (message) => {
      setMessagesInfinite(queryClient, conversation.id, (current) =>
        upsertMessageInInfinite(current, message),
      )
    },
  })

  const archiveMutation = useMutation({
    mutationFn: () => api.toggleArchive(accessToken!, conversation.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setInfoOpen(false)
    },
  })

  const batchDeleteMutation = useMutation({
    mutationFn: (messageIds: string[]) =>
      api.batchDelete(accessToken!, messageIds),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: messagesQueryKey(conversation.id),
      })
      setSelectionMode(false)
      setSelectedIds(new Set())
    },
  })

  const batchForwardMutation = useMutation({
    mutationFn: (targetConversationId: string) =>
      api.batchForward(accessToken!, [...selectedIds], targetConversationId),
    onSuccess: async () => {
      setBatchForwardOpen(false)
      setSelectionMode(false)
      setSelectedIds(new Set())
      await queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return [] as ChatMessage[]
    return allMessages.filter((message) =>
      (message.content || message.fileName || '').toLowerCase().includes(q),
    )
  }, [allMessages, searchQuery])

  useEffect(() => {
    setMatchIndex(0)
  }, [searchQuery, conversation.id])

  const activeMatchId =
    focusMessageId ?? searchMatches[matchIndex]?.id ?? null
  const visibleMessages =
    searchQuery.trim().length > 0 && searchMatches.length === 0
      ? []
      : allMessages

  const title =
    conversation.type === 'SAVED'
      ? 'Saved Messages'
      : (conversation.peer?.displayName ?? conversation.title)
  const isSaved = conversation.type === 'SAVED'
  const isGroup = conversation.type === 'GROUP'
  const statusLine = isSaved
    ? 'Forward here to save'
    : isGroup
      ? `${conversation.memberCount || conversation.members.length} members`
      : online
        ? 'online'
        : socketApi.connected
          ? formatLastSeen(peerLastSeen)
          : 'connecting...'

  const pinned = pinnedQuery.data?.[0] ?? null
  const selectedOwnCount = useMemo(() => {
    if (!currentUser) return 0
    return allMessages.filter(
      (message) =>
        selectedIds.has(message.id) && message.senderId === currentUser.id,
    ).length
  }, [allMessages, selectedIds, currentUser])

  function toggleSelect(message: ChatMessage) {
    if (message.deletedAt) return
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(message.id)) next.delete(message.id)
      else next.add(message.id)
      return next
    })
  }

  return (
    <section className="flex h-full flex-1 flex-col bg-[var(--chat-bg)]">
      <header className="glass-header flex h-[var(--header-height)] shrink-0 items-center gap-3 border-b border-[var(--border)] px-2 md:px-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onBack}
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="relative shrink-0">
          {isSaved ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-white">
              <Bookmark className="h-4 w-4 fill-current" />
            </div>
          ) : isGroup ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-3)] text-[var(--text-secondary)]">
              <Users className="h-4 w-4" />
            </div>
          ) : (
            <UserAvatar
              name={title}
              avatarUrl={conversation.peer?.avatarUrl}
              className="h-10 w-10"
            />
          )}
          {!isSaved && !isGroup && online ? (
            <span className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-[var(--sidebar-bg)] bg-[var(--online)]" />
          ) : null}
        </div>
        <div
          className="min-w-0 flex-1 cursor-pointer"
          onClick={() => {
            if (!isSaved) setInfoOpen(true)
          }}
          onKeyDown={(event) => {
            if (!isSaved && event.key === 'Enter') setInfoOpen(true)
          }}
          role="button"
          tabIndex={0}
        >
          <p className="truncate text-[15px] font-medium text-[var(--text-primary)]">
            {title}
          </p>
          {typingUser && !isSaved ? (
            <TypingIndicator name={typingUser} />
          ) : (
            <p
              className={`truncate text-[13px] ${
                !isSaved && !isGroup && online
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {statusLine}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Search in chat"
          onClick={() => setSearchOpen((open) => !open)}
        >
          <Search className="h-5 w-5" />
        </Button>
        {!isSaved ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Chat info"
            onClick={() => setInfoOpen(true)}
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        ) : null}
      </header>

      {searchOpen ? (
        <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--sidebar-bg)] px-3 py-2">
          <Input
            autoFocus
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search in conversation"
            className="h-9"
          />
          <span className="shrink-0 text-xs text-[var(--text-muted)]">
            {searchQuery.trim()
              ? `${searchMatches.length ? matchIndex + 1 : 0}/${searchMatches.length}`
              : ''}
          </span>
          <Button
            variant="ghost"
            size="icon"
            disabled={searchMatches.length === 0}
            onClick={() =>
              setMatchIndex((index) =>
                searchMatches.length
                  ? (index - 1 + searchMatches.length) % searchMatches.length
                  : 0,
              )
            }
            aria-label="Previous match"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={searchMatches.length === 0}
            onClick={() =>
              setMatchIndex((index) =>
                searchMatches.length ? (index + 1) % searchMatches.length : 0,
              )
            }
            aria-label="Next match"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSearchOpen(false)
              setSearchQuery('')
            }}
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      {pinned ? (
        <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--sidebar-bg)] px-4 py-2">
          <Pin className="h-4 w-4 text-[var(--accent)]" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-[var(--accent)]">Pinned Message</p>
            <p className="truncate text-xs text-[var(--text-secondary)]">{pinned.content}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Unpin"
            onClick={() => pinMutation.mutate(pinned)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      {messagesQuery.isLoading ? (
        <div className="relative flex-1 overflow-hidden">
          <div className="telegram-pattern absolute inset-0" />
          <div className="relative z-10 mx-auto flex max-w-3xl flex-col gap-3 px-4 py-6">
            {[72, 48, 90, 56, 64].map((width, index) => (
              <div
                key={width}
                className={`h-12 animate-pulse rounded-2xl bg-[var(--surface-1)]/70 ${
                  index % 2 === 0 ? 'self-start' : 'self-end'
                }`}
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
        </div>
      ) : (
        <MessageList
          key={conversation.id}
          messages={visibleMessages}
          currentUserId={currentUser!.id}
          unreadCount={conversation.unreadCount}
          searchQuery={searchQuery}
          activeMatchId={activeMatchId}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          hasMoreOlder={Boolean(messagesQuery.hasNextPage)}
          isFetchingOlder={messagesQuery.isFetchingNextPage}
          onLoadOlder={() => {
            if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) {
              void messagesQuery.fetchNextPage()
            }
          }}
          onReply={(message) => {
            setEditing(null)
            setReplyTo(message)
          }}
          onPin={(message) => pinMutation.mutate(message)}
          onForward={setForwardMessage}
          onEdit={(message) => {
            setReplyTo(null)
            setEditing(message)
          }}
          onDelete={(message) => {
            if (window.confirm('Delete this message for everyone?')) {
              deleteMutation.mutate(message)
            }
          }}
          onReact={(message, emoji) =>
            reactMutation.mutate({ messageId: message.id, emoji })
          }
          onEnterSelection={(message) => {
            setSelectionMode(true)
            setSelectedIds(new Set([message.id]))
          }}
          onToggleSelect={toggleSelect}
        />
      )}

      {selectionMode ? (
        <div className="flex items-center gap-2 border-t border-[var(--border)] bg-[var(--sidebar-bg)] px-3 py-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectionMode(false)
              setSelectedIds(new Set())
            }}
            aria-label="Cancel selection"
          >
            <X className="h-4 w-4" />
          </Button>
          <p className="min-w-0 flex-1 text-sm font-medium">
            {selectedIds.size} selected
          </p>
          <Button
            variant="ghost"
            size="icon"
            disabled={selectedIds.size === 0}
            onClick={() => setBatchForwardOpen(true)}
            aria-label="Forward selected"
          >
            <Forward className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={selectedOwnCount === 0 || batchDeleteMutation.isPending}
            onClick={() => {
              const ownIds = allMessages
                .filter(
                  (message) =>
                    selectedIds.has(message.id) &&
                    message.senderId === currentUser?.id,
                )
                .map((message) => message.id)
              if (
                ownIds.length &&
                window.confirm(`Delete ${ownIds.length} message(s)?`)
              ) {
                batchDeleteMutation.mutate(ownIds)
              }
            }}
            aria-label="Delete selected"
          >
            <Trash2 className="h-4 w-4 text-[var(--danger)]" />
          </Button>
        </div>
      ) : null}

      {sendError ? (
        <p className="px-4 pb-1 text-center text-xs text-red-500">{sendError}</p>
      ) : null}

      {!selectionMode ? (
      <MessageComposer
        conversationId={conversation.id}
        disabled={sendMutation.isPending || editMutation.isPending}
        replyTo={replyTo}
        editing={editing}
        draft={draft}
        onDraftChange={(value) => setDraft(conversation.id, value)}
        onCancelReply={() => setReplyTo(null)}
        onCancelEdit={() => setEditing(null)}
        onSend={async (content) => {
          await sendMutation.mutateAsync({ content, type: 'TEXT' })
        }}
        onEdit={async (content) => {
          await editMutation.mutateAsync(content)
        }}
        onSendFile={async (file) => {
          await sendMedia(file, file.name)
        }}
        onSendVoice={async (blob, durationMs) => {
          await sendMedia(blob, `voice-${Date.now()}.webm`, durationMs)
        }}
        onTypingStart={() => socketApi.startTyping(conversation.id)}
        onTypingStop={() => socketApi.stopTyping(conversation.id)}
      />
      ) : null}

      {forwardMessage || batchForwardOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-4 shadow-[var(--shadow-soft)]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {batchForwardOpen
                  ? `Forward ${selectedIds.size} messages`
                  : 'Forward message'}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setForwardMessage(null)
                  setBatchForwardOpen(false)
                }}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {forwardMessage ? (
              <p className="mb-3 truncate rounded-xl bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                {forwardMessage.type === 'VOICE'
                  ? 'Voice message'
                  : forwardMessage.type === 'IMAGE'
                    ? 'Photo'
                    : forwardMessage.type === 'FILE'
                      ? forwardMessage.fileName || 'File'
                      : forwardMessage.content || 'Message'}
              </p>
            ) : null}
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {conversations
                .filter((item) => item.id !== conversation.id && !item.isArchived)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-[var(--surface-2)]"
                    disabled={
                      forwardMutation.isPending || batchForwardMutation.isPending
                    }
                    onClick={() => {
                      if (batchForwardOpen) {
                        batchForwardMutation.mutate(item.id)
                      } else {
                        forwardMutation.mutate(item.id)
                      }
                    }}
                  >
                    <UserAvatar name={item.title} avatarUrl={item.peer?.avatarUrl} />
                    <span className="text-sm font-medium">{item.title}</span>
                  </button>
                ))}
              {conversations.filter(
                (item) => item.id !== conversation.id && !item.isArchived,
              ).length === 0 ? (
                <p className="px-2 py-4 text-sm text-[var(--text-muted)]">
                  No other chats to forward into yet.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {infoOpen ? (
        <ChatInfoSheet
          conversation={conversation}
          online={online}
          muted={muted}
          lastSeenAt={peerLastSeen}
          onToggleMute={() => muteMutation.mutate()}
          onToggleArchive={() => archiveMutation.mutate()}
          onTogglePin={() =>
            void api
              .updateConversation(accessToken!, conversation.id, {
                isPinned: !conversation.isPinned,
              })
              .then(() =>
                queryClient.invalidateQueries({ queryKey: ['conversations'] }),
              )
          }
          onClose={() => setInfoOpen(false)}
        />
      ) : null}
    </section>
  )
}
