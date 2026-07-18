import {
  BellOff,
  Check,
  CheckCheck,
  Pin,
  Users,
  Bookmark,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { UserAvatar } from '@/components/ui/user-avatar'
import { formatChatListTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import type { Conversation } from '@/types/chat'

export interface ChatListActions {
  onOpen: () => void
  onTogglePin: () => void
  onToggleMute: () => void
  onToggleArchive: () => void
  onMarkUnread: () => void
}

interface ChatListItemProps {
  chat: Conversation
  isActive: boolean
  peerOnline: boolean
  isMuted: boolean
  draft?: string | null
  actions: ChatListActions
}

function previewText(chat: Conversation, draft?: string | null) {
  if (draft?.trim()) return { text: draft.trim(), isDraft: true as const }
  const last = chat.lastMessage
  if (!last) {
    if (chat.type === 'GROUP') {
      return {
        text: `${chat.memberCount || chat.members.length} members`,
        isDraft: false as const,
      }
    }
    return { text: 'No messages yet', isDraft: false as const }
  }
  if (last.deletedAt) return { text: 'Message deleted', isDraft: false as const }
  if (last.type === 'VOICE') return { text: 'Voice message', isDraft: false as const }
  if (last.type === 'IMAGE') return { text: 'Photo', isDraft: false as const }
  if (last.type === 'FILE') {
    return { text: last.fileName || 'File', isDraft: false as const }
  }
  return { text: last.content || '', isDraft: false as const }
}

export function ChatListItem({
  chat,
  isActive,
  peerOnline,
  isMuted,
  draft,
  actions,
}: ChatListItemProps) {
  const currentUserId = useAuthStore((s) => s.user?.id)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const rowRef = useRef<HTMLButtonElement | null>(null)
  const preview = previewText(chat, draft)
  const isOwnLast =
    chat.lastMessage &&
    currentUserId &&
    chat.lastMessage.senderId === currentUserId &&
    !preview.isDraft
  const unread =
    (chat.unreadCount ?? 0) > 0 || Boolean(chat.markedUnread)
  const badgeCount =
    (chat.unreadCount ?? 0) > 0
      ? chat.unreadCount
      : chat.markedUnread
        ? 1
        : 0

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [menu])

  return (
    <>
      <button
        ref={rowRef}
        type="button"
        onClick={actions.onOpen}
        onContextMenu={(event) => {
          event.preventDefault()
          setMenu({ x: event.clientX, y: event.clientY })
        }}
        className={cn(
          'group relative flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
          isActive ? 'bg-[var(--chat-active)]' : 'hover:bg-[var(--chat-hover)]',
        )}
      >
        <div className="relative shrink-0">
          {chat.type === 'SAVED' ? (
            <div className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[var(--accent)] text-white">
              <Bookmark className="h-6 w-6 fill-current" />
            </div>
          ) : chat.type === 'GROUP' ? (
            <div className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[var(--surface-3)] text-[var(--text-secondary)]">
              <Users className="h-6 w-6" />
            </div>
          ) : (
            <UserAvatar
              name={chat.title}
              avatarUrl={chat.peer?.avatarUrl}
              className="h-[54px] w-[54px]"
            />
          )}
          {peerOnline ? (
            <span className="absolute right-0.5 bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--sidebar-bg)] bg-[var(--online)]" />
          ) : null}
        </div>

        <div
          className={cn(
            'min-w-0 flex-1 border-b border-[var(--border)] pb-2',
            isActive && 'border-transparent',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="flex min-w-0 items-center gap-1 truncate text-[15px] leading-5 font-medium text-[var(--text-primary)]">
              {chat.isPinned ? (
                <Pin className="h-3.5 w-3.5 shrink-0 rotate-45 text-[var(--text-muted)]" />
              ) : null}
              <span className="truncate">{chat.title}</span>
              {isMuted ? (
                <BellOff className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
              ) : null}
            </p>
            <span
              className={cn(
                'shrink-0 text-[13px] leading-5 tabular-nums',
                unread && !isMuted
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text-muted)]',
              )}
            >
              {formatChatListTime(chat.lastMessageAt)}
            </span>
          </div>

          <div className="mt-0.5 flex items-center justify-between gap-2">
            <p
              className={cn(
                'flex min-w-0 flex-1 items-center gap-1 truncate text-[14px] leading-5',
                preview.isDraft
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text-secondary)]',
              )}
            >
              {isOwnLast ? (
                <span className="inline-flex shrink-0 text-[var(--accent)]">
                  {chat.lastMessage?.status === 'SEEN' ? (
                    <CheckCheck className="h-4 w-4" />
                  ) : chat.lastMessage?.status === 'DELIVERED' ? (
                    <CheckCheck className="h-4 w-4 opacity-70" />
                  ) : (
                    <Check className="h-4 w-4 opacity-70" />
                  )}
                </span>
              ) : null}
              {preview.isDraft ? (
                <>
                  <span className="shrink-0 font-medium">Draft:</span>
                  <span className="truncate">{preview.text}</span>
                </>
              ) : (
                <span className="truncate">{preview.text}</span>
              )}
            </p>

            <div className="flex shrink-0 items-center gap-1">
              {chat.isPinned && !unread ? (
                <Pin className="h-3.5 w-3.5 rotate-45 text-[var(--text-muted)]" />
              ) : null}
              {badgeCount > 0 ? (
                <span
                  className={cn(
                    'h-[22px] min-w-[22px] rounded-full px-1.5 text-center text-[12px] leading-[22px] font-medium',
                    isMuted
                      ? 'bg-[var(--surface-3)] text-[var(--text-secondary)]'
                      : 'bg-[var(--unread-badge)] text-white',
                  )}
                >
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </button>

      {menu ? (
        <div
          className="fixed z-[80] min-w-[200px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-1)] py-1 shadow-[var(--shadow-soft)]"
          style={{
            left: Math.min(menu.x, window.innerWidth - 220),
            top: Math.min(menu.y, window.innerHeight - 220),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem
            label={chat.isPinned ? 'Unpin from top' : 'Pin to top'}
            onClick={() => {
              actions.onTogglePin()
              setMenu(null)
            }}
          />
          <MenuItem
            label={unread ? 'Mark as read' : 'Mark as unread'}
            onClick={() => {
              actions.onMarkUnread()
              setMenu(null)
            }}
          />
          <MenuItem
            label={isMuted ? 'Unmute' : 'Mute'}
            onClick={() => {
              actions.onToggleMute()
              setMenu(null)
            }}
          />
          {chat.type !== 'SAVED' ? (
            <MenuItem
              label={chat.isArchived ? 'Unarchive' : 'Archive'}
              onClick={() => {
                actions.onToggleArchive()
                setMenu(null)
              }}
            />
          ) : null}
        </div>
      ) : null}
    </>
  )
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex w-full px-3.5 py-2.5 text-left text-[14px] text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
      onClick={onClick}
    >
      {label}
    </button>
  )
}
