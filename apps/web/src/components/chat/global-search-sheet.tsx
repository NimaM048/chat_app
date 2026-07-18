import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { MessageSquare, Search, UserRound, Users, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/ui/user-avatar'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { useChatUiStore } from '@/stores/chat-ui-store'

interface GlobalSearchSheetProps {
  open: boolean
  onClose: () => void
  onStartChat: (username: string) => void
}

export function GlobalSearchSheet({
  open,
  onClose,
  onStartChat,
}: GlobalSearchSheetProps) {
  const accessToken = useAuthStore((state) => state.accessToken)
  const setActiveConversationId = useChatUiStore(
    (state) => state.setActiveConversationId,
  )
  const setFocusMessageId = useChatUiStore((state) => state.setFocusMessageId)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const searchQuery = useQuery({
    queryKey: ['global-search', query],
    enabled: open && query.trim().length >= 2 && Boolean(accessToken),
    queryFn: () => api.globalSearch(accessToken!, query.trim()),
  })

  if (!open) return null

  const data = searchQuery.data
  const empty =
    !searchQuery.isFetching &&
    query.trim().length >= 2 &&
    data &&
    data.users.length === 0 &&
    data.conversations.length === 0 &&
    data.messages.length === 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] shadow-[var(--shadow-soft)]"
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
          <Input
            autoFocus
            className="h-10 border-transparent bg-transparent shadow-none focus-visible:ring-0"
            placeholder="Search chats, users, messages…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="chat-scroll flex-1 overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <p className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">
              Type at least 2 characters
            </p>
          ) : null}

          {searchQuery.isFetching ? (
            <p className="px-3 py-4 text-sm text-[var(--text-muted)]">Searching…</p>
          ) : null}

          {empty ? (
            <p className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">
              No results for “{query.trim()}”
            </p>
          ) : null}

          {data?.conversations.length ? (
            <Section title="Chats" icon={<Users className="h-3.5 w-3.5" />}>
              {data.conversations.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-[var(--surface-2)]"
                  onClick={() => {
                    setActiveConversationId(chat.id)
                    onClose()
                  }}
                >
                  {chat.type === 'GROUP' ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                      <Users className="h-4 w-4" />
                    </div>
                  ) : (
                    <UserAvatar
                      name={chat.title}
                      avatarUrl={chat.peer?.avatarUrl}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{chat.title}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">
                      {chat.type === 'GROUP'
                        ? `${chat.memberCount} members`
                        : chat.peer
                          ? `@${chat.peer.username}`
                          : 'Saved Messages'}
                    </p>
                  </div>
                </button>
              ))}
            </Section>
          ) : null}

          {data?.users.length ? (
            <Section title="People" icon={<UserRound className="h-3.5 w-3.5" />}>
              {data.users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-[var(--surface-2)]"
                  onClick={() => {
                    onStartChat(user.username)
                    onClose()
                  }}
                >
                  <UserAvatar name={user.displayName} avatarUrl={user.avatarUrl} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{user.displayName}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">
                      @{user.username}
                    </p>
                  </div>
                </button>
              ))}
            </Section>
          ) : null}

          {data?.messages.length ? (
            <Section
              title="Messages"
              icon={<MessageSquare className="h-3.5 w-3.5" />}
            >
              {data.messages.map((message) => (
                <button
                  key={message.id}
                  type="button"
                  className="flex w-full flex-col gap-0.5 rounded-xl px-3 py-2 text-left hover:bg-[var(--surface-2)]"
                  onClick={() => {
                    setActiveConversationId(message.conversationId)
                    setFocusMessageId(message.id)
                    onClose()
                  }}
                >
                  <p className="text-xs font-medium text-[var(--accent)]">
                    {message.conversationTitle}
                  </p>
                  <p className="line-clamp-2 text-sm text-[var(--text-primary)]">
                    {message.content || message.fileName || 'Media'}
                  </p>
                </button>
              ))}
            </Section>
          ) : null}
        </div>
      </motion.div>
    </div>
  )
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mb-3">
      <p className="mb-1 flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
        {icon}
        {title}
      </p>
      {children}
    </div>
  )
}
