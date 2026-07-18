import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageBubble } from '@/components/chat/message-bubble'
import { Button } from '@/components/ui/button'
import type { ChatMessage } from '@/types/chat'

interface MessageListProps {
  messages: ChatMessage[]
  currentUserId: string
  unreadCount?: number
  searchQuery?: string
  activeMatchId?: string | null
  selectionMode?: boolean
  selectedIds?: Set<string>
  hasMoreOlder?: boolean
  isFetchingOlder?: boolean
  onLoadOlder?: () => void
  onReply: (message: ChatMessage) => void
  onPin: (message: ChatMessage) => void
  onForward: (message: ChatMessage) => void
  onEdit: (message: ChatMessage) => void
  onDelete: (message: ChatMessage) => void
  onReact: (message: ChatMessage, emoji: string) => void
  onEnterSelection?: (message: ChatMessage) => void
  onToggleSelect?: (message: ChatMessage) => void
}

function dayKey(iso: string) {
  const date = new Date(iso)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function formatDayLabel(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (dayKey(iso) === dayKey(today.toISOString())) return 'Today'
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return 'Yesterday'

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function MessageList({
  messages,
  currentUserId,
  unreadCount = 0,
  searchQuery = '',
  activeMatchId = null,
  selectionMode,
  selectedIds,
  hasMoreOlder = false,
  isFetchingOlder = false,
  onLoadOlder,
  onReply,
  onPin,
  onForward,
  onEdit,
  onDelete,
  onReact,
  onEnterSelection,
  onToggleSelect,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [showJump, setShowJump] = useState(false)
  const prevScrollHeight = useRef<number | null>(null)
  const prevMessageCount = useRef(messages.length)
  const initialScrollDone = useRef(false)
  const lastConversationTail = useRef<string | null>(null)

  const unreadStartId = useMemo(() => {
    if (unreadCount <= 0) return null
    const incoming = messages.filter(
      (message) => message.senderId !== currentUserId,
    )
    if (incoming.length === 0) return null
    return incoming[Math.max(0, incoming.length - unreadCount)]?.id ?? null
  }, [messages, currentUserId, unreadCount])

  const grouped = useMemo(() => {
    const items: Array<
      | { kind: 'date'; id: string; label: string }
      | { kind: 'unread'; id: string }
      | { kind: 'message'; message: ChatMessage }
    > = []

    let lastDay = ''
    for (const message of messages) {
      const key = dayKey(message.createdAt)
      if (key !== lastDay) {
        items.push({
          kind: 'date',
          id: `day-${key}`,
          label: formatDayLabel(message.createdAt),
        })
        lastDay = key
      }
      if (unreadStartId && message.id === unreadStartId) {
        items.push({ kind: 'unread', id: 'unread-divider' })
      }
      items.push({ kind: 'message', message })
    }
    return items
  }, [messages, unreadStartId])

  // Preserve scroll when older messages prepend
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (
      prevScrollHeight.current != null &&
      messages.length > prevMessageCount.current
    ) {
      const delta = el.scrollHeight - prevScrollHeight.current
      if (delta > 0 && el.scrollTop < 120) {
        el.scrollTop += delta
      }
    }
    prevScrollHeight.current = el.scrollHeight
    prevMessageCount.current = messages.length
  }, [messages])

  // Initial scroll to bottom / follow new messages / focus match
  useEffect(() => {
    if (activeMatchId) {
      document
        .getElementById(`msg-${activeMatchId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    const tailId = messages.at(-1)?.id ?? null
    const isNewTail = tailId !== lastConversationTail.current
    lastConversationTail.current = tailId

    if (!initialScrollDone.current && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' })
      initialScrollDone.current = true
      return
    }

    const el = scrollRef.current
    const nearBottom =
      el != null &&
      el.scrollHeight - el.scrollTop - el.clientHeight < 160

    if (isNewTail && nearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.at(-1)?.id, activeMatchId, messages.length])

  // Reset initial scroll when message list is cleared (conversation switch handled by remount key)
  useEffect(() => {
    if (messages.length === 0) {
      initialScrollDone.current = false
      lastConversationTail.current = null
    }
  }, [messages.length])

  return (
    <div className="relative flex-1 overflow-hidden">
      <div className="telegram-pattern pointer-events-none absolute inset-0" />
      <div
        ref={scrollRef}
        className="chat-scroll relative z-10 h-full overflow-y-auto px-2 py-2 md:px-4"
        onScroll={(event) => {
          const el = event.currentTarget
          const distance = el.scrollHeight - el.scrollTop - el.clientHeight
          setShowJump(distance > 140)
          if (el.scrollTop < 80 && hasMoreOlder && !isFetchingOlder) {
            prevScrollHeight.current = el.scrollHeight
            onLoadOlder?.()
          }
        }}
      >
        <div className="mx-auto flex max-w-[728px] flex-col gap-1.5">
          {isFetchingOlder ? (
            <div className="flex justify-center py-2">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : null}
          {searchQuery.trim() && messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--text-muted)]">
              No messages matched “{searchQuery.trim()}”
            </p>
          ) : null}
          {grouped.map((item) => {
            if (item.kind === 'date') {
              return (
                <div
                  key={item.id}
                  className="sticky top-2 z-20 flex justify-center py-2"
                >
                  <span className="date-chip rounded-full px-2.5 py-0.5 text-[13px] font-medium">
                    {item.label}
                  </span>
                </div>
              )
            }

            if (item.kind === 'unread') {
              return (
                <div key={item.id} className="flex items-center gap-3 py-1.5">
                  <div className="h-px flex-1 bg-[var(--accent)]/35" />
                  <span className="text-[13px] font-medium text-[var(--accent)]">
                    Unread messages
                  </span>
                  <div className="h-px flex-1 bg-[var(--accent)]/35" />
                </div>
              )
            }

            return (
              <MessageBubble
                key={item.message.id}
                message={item.message}
                isOwn={item.message.senderId === currentUserId}
                highlight={item.message.id === activeMatchId}
                selectionMode={selectionMode}
                selected={selectedIds?.has(item.message.id)}
                onReply={onReply}
                onPin={onPin}
                onForward={onForward}
                onEdit={onEdit}
                onDelete={onDelete}
                onReact={onReact}
                onEnterSelection={onEnterSelection}
                onToggleSelect={onToggleSelect}
              />
            )
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      <AnimatePresence>
        {showJump ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="absolute right-4 bottom-4 z-30"
          >
            <Button
              size="icon"
              className="h-10 w-10 rounded-full bg-[var(--surface-1)] text-[var(--text-secondary)] shadow-[var(--bubble-shadow)] hover:bg-[var(--surface-1)] hover:text-[var(--text-primary)]"
              onClick={() =>
                bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
              }
              aria-label="Jump to latest"
            >
              <ChevronDown className="h-5 w-5" />
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
