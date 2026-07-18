import {
  Check,
  CheckCheck,
  Copy,
  Download,
  FileIcon,
  Forward,
  ListChecks,
  Pause,
  Pencil,
  Pin,
  Play,
  Reply,
  SmilePlus,
  Trash2,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { LinkPreview } from '@/components/chat/link-preview'
import { extractUrls, renderTextWithLinks } from '@/lib/link-utils'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/types/chat'

const MEDIA_BASE =
  import.meta.env.VITE_SOCKET_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '😂', '😮', '😢']

interface MessageBubbleProps {
  message: ChatMessage
  isOwn: boolean
  highlight?: boolean
  selectionMode?: boolean
  selected?: boolean
  onReply: (message: ChatMessage) => void
  onPin: (message: ChatMessage) => void
  onForward: (message: ChatMessage) => void
  onEdit: (message: ChatMessage) => void
  onDelete: (message: ChatMessage) => void
  onReact: (message: ChatMessage, emoji: string) => void
  onEnterSelection?: (message: ChatMessage) => void
  onToggleSelect?: (message: ChatMessage) => void
}

export function MessageBubble({
  message,
  isOwn,
  highlight,
  selectionMode,
  selected,
  onReply,
  onPin,
  onForward,
  onEdit,
  onDelete,
  onReact,
  onEnterSelection,
  onToggleSelect,
}: MessageBubbleProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [reactOpen, setReactOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 })
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const deleted = Boolean(message.deletedAt)
  const metaTone = isOwn
    ? 'text-[color-mix(in_srgb,var(--bubble-own-text)_55%,transparent)]'
    : 'text-[var(--text-muted)]'
  const softTone = isOwn
    ? 'text-[color-mix(in_srgb,var(--bubble-own-text)_70%,transparent)]'
    : 'text-[var(--accent)]'
  const hasLink = !deleted && extractUrls(message.content).length > 0

  useEffect(() => {
    if (!menuOpen && !reactOpen) return
    const close = () => {
      setMenuOpen(false)
      setReactOpen(false)
    }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menuOpen, reactOpen])

  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  const mediaUrl = message.fileUrl
    ? message.fileUrl.startsWith('http')
      ? message.fileUrl
      : `${MEDIA_BASE}${message.fileUrl}`
    : null

  const reactions = message.reactions ?? []

  return (
    <div
      id={`msg-${message.id}`}
      className={cn(
        'group relative flex w-full scroll-mt-20',
        isOwn ? 'justify-end' : 'justify-start',
        selected && 'bg-[var(--accent-soft)]/40',
        highlight && 'rounded-lg ring-2 ring-[var(--accent)]/50',
        message.optimistic && 'opacity-70',
      )}
      onClick={() => {
        if (selectionMode && !deleted) onToggleSelect?.(message)
      }}
      onContextMenu={(event) => {
        if (deleted) return
        event.preventDefault()
        if (selectionMode) {
          onToggleSelect?.(message)
          return
        }
        setMenuPos({ x: event.clientX, y: event.clientY })
        setMenuOpen(true)
        setReactOpen(false)
      }}
    >
      {selectionMode && !deleted ? (
        <div
          className={cn(
            'mr-2 flex items-center self-center',
            isOwn && 'order-2 ml-2 mr-0',
          )}
        >
          <span
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full border-2',
              selected
                ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                : 'border-[var(--text-muted)]',
            )}
          >
            {selected ? <Check className="h-3 w-3" /> : null}
          </span>
        </div>
      ) : null}
      <div className="relative max-w-[min(78%,420px)]">
        <div
          className={cn(
            'tg-bubble px-2.5 py-1.5 text-[15px] leading-[1.35]',
            isOwn
              ? 'tg-bubble-own bg-[var(--bubble-own)] text-[var(--bubble-own-text)]'
              : 'tg-bubble-other bg-[var(--bubble-other)] text-[var(--text-primary)]',
            message.isPinned && !deleted && 'ring-1 ring-[var(--accent)]/40',
            deleted && 'italic opacity-80',
          )}
        >
          {deleted ? (
            <p className={cn('leading-5', metaTone)}>This message was deleted</p>
          ) : (
            <>
              {message.forwardedFrom ? (
                <p className={cn('mb-1 text-[11px] font-medium', softTone)}>
                  Forwarded from {message.forwardedFrom.senderName}
                </p>
              ) : null}

              {message.replyTo ? (
                <div
                  className={cn(
                    'mb-2 rounded-lg border-l-2 px-2 py-1 text-xs',
                    isOwn
                      ? 'border-[color-mix(in_srgb,var(--bubble-own-text)_45%,transparent)] bg-black/5'
                      : 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text-secondary)]',
                  )}
                >
                  <p className="font-semibold">{message.replyTo.senderName}</p>
                  <p className="truncate">{message.replyTo.content || 'Media'}</p>
                </div>
              ) : null}

              {message.type === 'IMAGE' && mediaUrl ? (
                <a href={mediaUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl">
                  <img
                    src={mediaUrl}
                    alt={message.fileName ?? 'image'}
                    className="max-h-64 w-full object-cover"
                  />
                </a>
              ) : null}

              {message.type === 'FILE' && mediaUrl ? (
                <a
                  href={mediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    'mb-1 flex items-center gap-3 rounded-xl px-3 py-2',
                    isOwn ? 'bg-black/5' : 'bg-[var(--surface-2)]',
                  )}
                >
                  <FileIcon className="h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{message.fileName ?? 'File'}</p>
                    <p className={cn('text-[11px]', metaTone)}>
                      {formatBytes(message.fileSize)}
                    </p>
                  </div>
                  <Download className="h-4 w-4 shrink-0 opacity-80" />
                </a>
              ) : null}

              {message.type === 'VOICE' && mediaUrl ? (
                <div className="mb-1 flex min-w-[220px] items-center gap-3">
                  <button
                    type="button"
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full',
                      isOwn ? 'bg-black/8' : 'bg-[var(--accent-soft)] text-[var(--accent)]',
                    )}
                    onClick={() => {
                      if (!audioRef.current) {
                        audioRef.current = new Audio(mediaUrl)
                        audioRef.current.onended = () => setPlaying(false)
                      }
                      if (playing) {
                        audioRef.current.pause()
                        setPlaying(false)
                      } else {
                        void audioRef.current.play()
                        setPlaying(true)
                      }
                    }}
                  >
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <div className="flex-1">
                    <div className="voice-wave mb-1 h-7 overflow-hidden rounded-full opacity-80" />
                    <p className={cn('text-[11px]', metaTone)}>
                      {formatDuration(message.durationMs)}
                    </p>
                  </div>
                </div>
              ) : null}

              {message.content ? (
                <p className="message-text whitespace-pre-wrap break-words leading-5">
                  {renderTextWithLinks(message.content).map((part, index) =>
                    part.type === 'link' ? (
                      <a
                        key={`${part.value}-${index}`}
                        href={part.value}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          'underline underline-offset-2',
                          isOwn ? 'text-[var(--accent)]' : 'text-[var(--accent)]',
                        )}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {part.value}
                      </a>
                    ) : (
                      <span key={`${index}-${part.value.slice(0, 8)}`}>{part.value}</span>
                    ),
                  )}
                </p>
              ) : null}

              {hasLink ? <LinkPreview content={message.content} isOwn={isOwn} /> : null}
            </>
          )}

          <div className={cn('mt-0.5 flex items-end justify-end gap-1 text-[12px] leading-none', metaTone)}>
            {message.isPinned && !deleted ? <Pin className="h-3 w-3" /> : null}
            {message.editedAt && !deleted ? <span className="mr-0.5">edited</span> : null}
            <span>{time}</span>
            {isOwn ? (
              message.status === 'SEEN' ? (
                <CheckCheck className="h-3.5 w-3.5 text-[var(--accent)]" />
              ) : message.status === 'DELIVERED' ? (
                <CheckCheck className="h-3.5 w-3.5" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )
            ) : null}
          </div>
        </div>

        {!deleted ? (
          <div
            className={cn(
              'mt-1 flex flex-wrap items-center gap-1',
              isOwn ? 'justify-end' : 'justify-start',
            )}
          >
            <AnimatePresence initial={false}>
              {reactions.map((reaction) => (
                <motion.button
                  key={reaction.emoji}
                  type="button"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-xs shadow-sm transition-colors',
                    reaction.reactedByMe
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                      : 'border-[var(--border)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)]',
                  )}
                  onClick={(event) => {
                    event.stopPropagation()
                    onReact(message, reaction.emoji)
                  }}
                >
                  {reaction.emoji} {reaction.count}
                </motion.button>
              ))}
            </AnimatePresence>
            <button
              type="button"
              className="rounded-full border border-[var(--border)] bg-[var(--surface-1)] p-1 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
              aria-label="Add reaction"
              onClick={(event) => {
                event.stopPropagation()
                setReactOpen((open) => !open)
                setMenuOpen(false)
              }}
            >
              <SmilePlus className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            </button>
          </div>
        ) : null}

        <AnimatePresence>
          {reactOpen && !deleted ? (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              className={cn(
                'absolute z-40 flex gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1.5 shadow-[var(--shadow-soft)]',
                isOwn ? 'right-0 bottom-full mb-2' : 'left-0 bottom-full mb-2',
              )}
              onClick={(event) => event.stopPropagation()}
            >
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="rounded-full px-1.5 text-lg transition-transform hover:scale-125"
                  onClick={() => {
                    onReact(message, emoji)
                    setReactOpen(false)
                  }}
                >
                  {emoji}
                </button>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {menuOpen && !deleted ? (
        <div
          className="fixed z-50 min-w-40 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-1)] py-1 shadow-[var(--shadow-soft)]"
          style={{ left: menuPos.x, top: menuPos.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <MenuItem icon={<Reply className="h-4 w-4" />} label="Reply" onClick={() => { onReply(message); setMenuOpen(false) }} />
          <MenuItem
            icon={<ListChecks className="h-4 w-4" />}
            label="Select"
            onClick={() => {
              onEnterSelection?.(message)
              setMenuOpen(false)
            }}
          />
          {isOwn && message.type === 'TEXT' ? (
            <MenuItem icon={<Pencil className="h-4 w-4" />} label="Edit" onClick={() => { onEdit(message); setMenuOpen(false) }} />
          ) : null}
          <MenuItem icon={<Pin className="h-4 w-4" />} label={message.isPinned ? 'Unpin' : 'Pin'} onClick={() => { onPin(message); setMenuOpen(false) }} />
          <MenuItem icon={<Forward className="h-4 w-4" />} label="Forward" onClick={() => { onForward(message); setMenuOpen(false) }} />
          <MenuItem
            icon={<Copy className="h-4 w-4" />}
            label="Copy"
            onClick={async () => {
              await navigator.clipboard.writeText(message.content || message.fileName || '')
              setMenuOpen(false)
            }}
          />
          {isOwn ? (
            <MenuItem
              icon={<Trash2 className="h-4 w-4 text-[var(--danger)]" />}
              label="Delete"
              danger
              onClick={() => {
                onDelete(message)
                setMenuOpen(false)
              }}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]',
        danger ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]',
      )}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  )
}

function formatBytes(size?: number | null) {
  if (!size) return 'File'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(ms?: number | null) {
  const total = Math.max(1, Math.round((ms ?? 1000) / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

