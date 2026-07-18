import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  LogOut,
  MessageCircle,
  Plus,
  Search,
  Settings,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChatListItem } from '@/components/chat/chat-list-item'
import { CreateGroupSheet } from '@/components/chat/create-group-sheet'
import { GlobalSearchSheet } from '@/components/chat/global-search-sheet'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/ui/user-avatar'
import { api } from '@/lib/api'
import { MUTE_FOREVER_ISO } from '@/lib/device'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useChatUiStore } from '@/stores/chat-ui-store'
import type { User } from '@/types/auth'
import type { Conversation } from '@/types/chat'

interface ChatSidebarProps {
  user: User
  onLogout: () => void
  conversations: Conversation[]
  isLoading: boolean
}

function sortChats(list: Conversation[]) {
  return [...list].sort((a, b) => {
    if (a.type === 'SAVED' && b.type !== 'SAVED') return -1
    if (b.type === 'SAVED' && a.type !== 'SAVED') return 1
    const aPinned = Boolean(a.isPinned)
    const bPinned = Boolean(b.isPinned)
    if (aPinned !== bPinned) return aPinned ? -1 : 1
    if (aPinned && bPinned) {
      const ao = a.pinOrder ?? 0
      const bo = b.pinOrder ?? 0
      if (ao !== bo) return ao - bo
    }
    const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
    const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
    return bt - at
  })
}

export function ChatSidebar({
  user,
  onLogout,
  conversations,
  isLoading,
}: ChatSidebarProps) {
  const navigate = useNavigate()
  const accessToken = useAuthStore((state) => state.accessToken)
  const queryClient = useQueryClient()
  const activeConversationId = useChatUiStore((state) => state.activeConversationId)
  const setActiveConversationId = useChatUiStore(
    (state) => state.setActiveConversationId,
  )
  const onlineUserIds = useChatUiStore((state) => state.onlineUserIds)
  const draftsByConversation = useChatUiStore((state) => state.draftsByConversation)
  const mutedConversationIds = useChatUiStore((state) => state.mutedConversationIds)
  const setMuted = useChatUiStore((state) => state.setMuted)
  const [search, setSearch] = useState('')
  const [peerQuery, setPeerQuery] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)
  const [listFilter, setListFilter] = useState<'all' | 'unread'>('all')

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setShowGlobalSearch(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = sortChats(conversations)
    if (!q) return list
    return list.filter(
      (conversation) =>
        conversation.title.toLowerCase().includes(q) ||
        conversation.peer?.username.toLowerCase().includes(q) ||
        conversation.lastMessage?.content.toLowerCase().includes(q),
    )
  }, [conversations, search])

  const activeChats = filtered.filter((chat) => !chat.isArchived)
  const archivedChats = filtered.filter((chat) => chat.isArchived)
  const unreadCount = activeChats.filter(
    (chat) => chat.unreadCount > 0 || chat.markedUnread,
  ).length

  const pinnedChats = activeChats.filter((chat) => chat.isPinned)
  const unpinnedChats = activeChats.filter((chat) => !chat.isPinned)

  const visibleChats = showArchived
    ? archivedChats
    : listFilter === 'unread'
      ? activeChats.filter((chat) => chat.unreadCount > 0 || chat.markedUnread)
      : null

  const usersQuery = useQuery({
    queryKey: ['users-search', peerQuery],
    enabled: showNewChat && peerQuery.trim().length >= 2 && Boolean(accessToken),
    queryFn: () => api.searchUsers(accessToken!, peerQuery.trim()),
  })

  const createMutation = useMutation({
    mutationFn: (peer: string) => api.createDirect(accessToken!, peer),
    onSuccess: async (conversation) => {
      await queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setActiveConversationId(conversation.id)
      setShowNewChat(false)
      setPeerQuery('')
    },
  })

  const patchConversation = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: {
        mutedUntil?: string | null
        isArchived?: boolean
        isPinned?: boolean
        markedUnread?: boolean
      }
    }) => api.updateConversation(accessToken!, id, patch),
    onSuccess: async (conversation) => {
      if (conversation.isMuted !== undefined) {
        setMuted(conversation.id, Boolean(conversation.isMuted))
      }
      await queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.toggleArchive(accessToken!, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })

  function renderChat(chat: Conversation) {
    const isMuted =
      Boolean(mutedConversationIds[chat.id]) || Boolean(chat.isMuted)
    return (
      <ChatListItem
        key={chat.id}
        chat={chat}
        isActive={chat.id === activeConversationId}
        peerOnline={chat.peer ? Boolean(onlineUserIds[chat.peer.id]) : false}
        isMuted={isMuted}
        draft={draftsByConversation[chat.id] ?? chat.draft}
        actions={{
          onOpen: () => {
            setActiveConversationId(chat.id)
            if (chat.markedUnread && accessToken) {
              patchConversation.mutate({
                id: chat.id,
                patch: { markedUnread: false },
              })
            }
          },
          onTogglePin: () =>
            patchConversation.mutate({
              id: chat.id,
              patch: { isPinned: !chat.isPinned },
            }),
          onToggleMute: () =>
            patchConversation.mutate({
              id: chat.id,
              patch: {
                mutedUntil: isMuted ? null : MUTE_FOREVER_ISO,
              },
            }),
          onToggleArchive: () => archiveMutation.mutate(chat.id),
          onMarkUnread: () => {
            const currentlyUnread =
              chat.unreadCount > 0 || Boolean(chat.markedUnread)
            patchConversation.mutate({
              id: chat.id,
              patch: { markedUnread: !currentlyUnread },
            })
            if (!currentlyUnread && chat.id === activeConversationId) {
              setActiveConversationId(null)
            }
          },
        }}
      />
    )
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)] md:w-[var(--sidebar-width)] md:min-w-[var(--sidebar-width)] md:max-w-[var(--sidebar-width)]">
      <div className="glass-header flex h-[var(--header-height)] items-center justify-between px-3">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar
            name={user.displayName}
            avatarUrl={user.avatarUrl}
            className="h-10 w-10"
          />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium text-[var(--text-primary)]">
              {user.displayName}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Global search"
            onClick={() => setShowGlobalSearch(true)}
          >
            <Search className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="New group"
            onClick={() => {
              setShowNewGroup(true)
              setShowNewChat(false)
            }}
          >
            <Users className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="New chat"
            onClick={() => {
              setShowNewChat((value) => !value)
              setShowNewGroup(false)
            }}
          >
            <Plus className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Settings"
            onClick={() => navigate('/app/settings')}
          >
            <Settings className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Logout">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <Input
            className="h-10 rounded-full bg-[var(--surface-2)] pr-4 pl-10"
            placeholder="Search"
            value={showNewChat ? peerQuery : search}
            onChange={(event) =>
              showNewChat
                ? setPeerQuery(event.target.value)
                : setSearch(event.target.value)
            }
          />
        </div>
      </div>

      {!showNewChat ? (
        <div className="flex gap-0 border-b border-[var(--border)] px-2">
          <button
            type="button"
            className={cn(
              'relative h-10 flex-1 text-[13px] font-medium transition-colors',
              !showArchived && listFilter === 'all'
                ? 'text-[var(--accent)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            )}
            onClick={() => {
              setShowArchived(false)
              setListFilter('all')
            }}
          >
            All chats
            {!showArchived && listFilter === 'all' ? (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--accent)]" />
            ) : null}
          </button>
          <button
            type="button"
            className={cn(
              'relative h-10 flex-1 text-[13px] font-medium transition-colors',
              !showArchived && listFilter === 'unread'
                ? 'text-[var(--accent)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            )}
            onClick={() => {
              setShowArchived(false)
              setListFilter('unread')
            }}
          >
            Unread
            {unreadCount > 0 ? (
              <span className="ml-1 text-[11px] text-[var(--text-muted)]">
                {unreadCount}
              </span>
            ) : null}
            {!showArchived && listFilter === 'unread' ? (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--accent)]" />
            ) : null}
          </button>
          <button
            type="button"
            className={cn(
              'relative h-10 flex-1 text-[13px] font-medium transition-colors',
              showArchived
                ? 'text-[var(--accent)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            )}
            onClick={() => setShowArchived(true)}
          >
            Archived
            {archivedChats.length > 0 ? (
              <span className="ml-1 text-[11px] text-[var(--text-muted)]">
                {archivedChats.length}
              </span>
            ) : null}
            {showArchived ? (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--accent)]" />
            ) : null}
          </button>
        </div>
      ) : null}

      <div className="chat-scroll flex-1 overflow-y-auto">
        {showNewChat ? (
          <div className="p-2">
            <p className="px-2 py-2 text-xs font-medium tracking-wide text-[var(--text-muted)] uppercase">
              Start a conversation
            </p>
            {usersQuery.isFetching ? (
              <p className="px-3 py-2 text-sm text-[var(--text-muted)]">Searching...</p>
            ) : null}
            {(usersQuery.data ?? []).map((result) => (
              <button
                key={result.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-[var(--surface-2)]"
                onClick={() => createMutation.mutate(result.username)}
              >
                <UserAvatar name={result.displayName} avatarUrl={result.avatarUrl} />
                <div>
                  <p className="text-sm font-medium">{result.displayName}</p>
                  <p className="text-xs text-[var(--text-muted)]">@{result.username}</p>
                </div>
              </button>
            ))}
            {peerQuery.trim().length >= 2 &&
            !usersQuery.isFetching &&
            (usersQuery.data?.length ?? 0) === 0 ? (
              <p className="px-3 py-2 text-sm text-[var(--text-muted)]">No users found</p>
            ) : null}
          </div>
        ) : isLoading ? (
          <p className="px-4 py-6 text-sm text-[var(--text-muted)]">Loading chats...</p>
        ) : (visibleChats ?? [...pinnedChats, ...unpinnedChats]).length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            {showArchived ? (
              <Archive className="h-10 w-10 text-[var(--accent)]" />
            ) : (
              <MessageCircle className="h-10 w-10 text-[var(--accent)]" />
            )}
            <div>
              <p className="font-medium text-[var(--text-primary)]">
                {showArchived
                  ? 'No archived chats'
                  : listFilter === 'unread'
                    ? 'No unread chats'
                    : 'No chats yet'}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {showArchived
                  ? 'Archive a chat from the context menu or chat info.'
                  : 'Tap + for a DM or the people icon for a group.'}
              </p>
            </div>
          </div>
        ) : visibleChats ? (
          visibleChats.map(renderChat)
        ) : (
          <>
            {pinnedChats.length > 0 ? (
              <div>
                <p className="px-4 pt-3 pb-1 text-[12px] font-medium tracking-wide text-[var(--text-muted)] uppercase">
                  Pinned
                </p>
                {pinnedChats.map(renderChat)}
              </div>
            ) : null}
            {unpinnedChats.map(renderChat)}
          </>
        )}
      </div>

      {showNewGroup && accessToken ? (
        <CreateGroupSheet
          accessToken={accessToken}
          onClose={() => setShowNewGroup(false)}
          onCreated={async (conversation) => {
            await queryClient.invalidateQueries({ queryKey: ['conversations'] })
            setActiveConversationId(conversation.id)
            setShowNewGroup(false)
            setShowArchived(false)
          }}
        />
      ) : null}

      <GlobalSearchSheet
        open={showGlobalSearch}
        onClose={() => setShowGlobalSearch(false)}
        onStartChat={(username) => {
          createMutation.mutate(username)
        }}
      />
    </aside>
  )
}

export function ChatPanelEmpty() {
  return (
    <section className="relative hidden flex-1 flex-col items-center justify-center overflow-hidden bg-[var(--chat-bg)] md:flex">
      <div className="telegram-pattern absolute inset-0" />
      <div className="relative z-10 px-6">
        <p className="rounded-full bg-[var(--date-chip-bg)] px-4 py-1.5 text-[14px] text-[var(--date-chip-fg)]">
          Select a chat to start messaging
        </p>
      </div>
    </section>
  )
}
