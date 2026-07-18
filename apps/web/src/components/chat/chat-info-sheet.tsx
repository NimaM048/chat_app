import {
  Archive,
  ArchiveRestore,
  Ban,
  Bell,
  BellOff,
  Copy,
  Pin,
  PinOff,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/ui/user-avatar'
import { api } from '@/lib/api'
import { formatLastSeen } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'
import type { Conversation } from '@/types/chat'

interface ChatInfoSheetProps {
  conversation: Conversation
  online: boolean
  muted: boolean
  lastSeenAt?: string | null
  onToggleMute: () => void
  onToggleArchive: () => void
  onTogglePin: () => void
  onClose: () => void
}

export function ChatInfoSheet({
  conversation,
  online,
  muted,
  lastSeenAt,
  onToggleMute,
  onToggleArchive,
  onTogglePin,
  onClose,
}: ChatInfoSheetProps) {
  const peer = conversation.peer
  const title = peer?.displayName ?? conversation.title
  const username = peer?.username
  const isGroup = conversation.type === 'GROUP'
  const canArchive = conversation.type !== 'SAVED'
  const accessToken = useAuthStore((s) => s.accessToken)
  const queryClient = useQueryClient()

  const blockMutation = useMutation({
    mutationFn: () => api.blockUser(accessToken!, peer!.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['blocks'] })
      await queryClient.invalidateQueries({ queryKey: ['conversations'] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <motion.aside
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="flex h-full w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--sidebar-bg)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-14 items-center justify-between border-b border-[var(--border)] px-4">
          <h2 className="text-[16px] font-medium text-[var(--text-primary)]">
            {isGroup ? 'Group Info' : 'User Info'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="chat-scroll flex-1 overflow-y-auto">
          <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
            {isGroup ? (
              <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full bg-[var(--surface-3)] text-[var(--text-secondary)]">
                <Users className="h-12 w-12" />
              </div>
            ) : (
              <UserAvatar
                name={title}
                avatarUrl={peer?.avatarUrl}
                className="h-[120px] w-[120px]"
                fallbackClassName="text-3xl"
              />
            )}
            <div className="mt-2">
              <p className="text-[20px] font-medium text-[var(--text-primary)]">
                {title}
              </p>
              {username ? (
                <p className="mt-0.5 text-[14px] text-[var(--accent)]">@{username}</p>
              ) : null}
              <p
                className={`mt-1 text-[14px] ${
                  !isGroup && online
                    ? 'text-[var(--online)]'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                {isGroup
                  ? `${conversation.memberCount || conversation.members.length} members`
                  : online
                    ? 'online'
                    : formatLastSeen(lastSeenAt ?? peer?.lastSeenAt)}
              </p>
              {peer?.bio ? (
                <p className="mt-3 max-w-sm text-[14px] text-[var(--text-secondary)]">
                  {peer.bio}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2 px-3 pb-6">
            {isGroup ? (
              <section className="overflow-hidden rounded-xl bg-[var(--surface-2)]">
                <p className="px-4 pt-3 pb-1 text-[13px] font-medium text-[var(--accent)]">
                  {conversation.memberCount || conversation.members.length} members
                </p>
                <div className="max-h-56 overflow-y-auto">
                  {conversation.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 px-4 py-2.5"
                    >
                      <UserAvatar
                        name={member.displayName}
                        avatarUrl={member.avatarUrl}
                        className="h-10 w-10"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-medium">
                          {member.displayName}
                        </p>
                        <p className="truncate text-[13px] text-[var(--text-muted)]">
                          @{member.username}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {username ? (
              <InfoRow
                icon={<UserRound className="h-5 w-5" />}
                label="Username"
                value={`@${username}`}
                onCopy={() => void navigator.clipboard.writeText(`@${username}`)}
              />
            ) : null}

            <section className="overflow-hidden rounded-xl bg-[var(--surface-2)]">
              <ActionRow
                icon={
                  conversation.isPinned ? (
                    <PinOff className="h-5 w-5 text-[var(--accent)]" />
                  ) : (
                    <Pin className="h-5 w-5 text-[var(--text-secondary)]" />
                  )
                }
                title={conversation.isPinned ? 'Unpin from top' : 'Pin to top'}
                onClick={onTogglePin}
              />
              <ActionRow
                icon={
                  muted ? (
                    <BellOff className="h-5 w-5 text-[var(--accent)]" />
                  ) : (
                    <Bell className="h-5 w-5 text-[var(--text-secondary)]" />
                  )
                }
                title={muted ? 'Unmute' : 'Mute'}
                subtitle={muted ? 'Notifications are muted' : undefined}
                onClick={onToggleMute}
              />
              {canArchive ? (
                <ActionRow
                  icon={
                    conversation.isArchived ? (
                      <ArchiveRestore className="h-5 w-5 text-[var(--accent)]" />
                    ) : (
                      <Archive className="h-5 w-5 text-[var(--text-secondary)]" />
                    )
                  }
                  title={
                    conversation.isArchived ? 'Unarchive chat' : 'Archive chat'
                  }
                  onClick={onToggleArchive}
                />
              ) : null}
            </section>

            {!isGroup && peer ? (
              <section className="overflow-hidden rounded-xl bg-[var(--surface-2)]">
                <ActionRow
                  icon={<Ban className="h-5 w-5 text-[var(--danger)]" />}
                  title={
                    blockMutation.isPending ? 'Blocking…' : 'Block user'
                  }
                  danger
                  onClick={() => {
                    if (
                      window.confirm(
                        `Block ${peer.displayName}? They won't be able to message you.`,
                      )
                    ) {
                      blockMutation.mutate()
                    }
                  }}
                />
              </section>
            ) : null}
          </div>
        </div>
      </motion.aside>
    </div>
  )
}

function ActionRow({
  icon,
  title,
  subtitle,
  onClick,
  danger,
}: {
  icon: ReactNode
  title: string
  subtitle?: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-3)]"
    >
      {icon}
      <div className="min-w-0 flex-1">
        <p
          className={`text-[15px] ${
            danger ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'
          }`}
        >
          {title}
        </p>
        {subtitle ? (
          <p className="text-[13px] text-[var(--text-muted)]">{subtitle}</p>
        ) : null}
      </div>
    </button>
  )
}

function InfoRow({
  icon,
  label,
  value,
  onCopy,
}: {
  icon: ReactNode
  label: string
  value: string
  onCopy: () => void
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-[var(--surface-2)] px-4 py-3">
      <span className="text-[var(--text-secondary)]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-[var(--accent)]">{label}</p>
        <p className="truncate text-[15px] text-[var(--text-primary)]">{value}</p>
      </div>
      <Button variant="ghost" size="icon" onClick={onCopy} aria-label={`Copy ${label}`}>
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  )
}
