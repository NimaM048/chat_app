import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/ui/user-avatar'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { User } from '@/types/auth'
import type { Conversation } from '@/types/chat'

interface CreateGroupSheetProps {
  accessToken: string
  onClose: () => void
  onCreated: (conversation: Conversation) => void
}

export function CreateGroupSheet({
  accessToken,
  onClose,
  onCreated,
}: CreateGroupSheetProps) {
  const [title, setTitle] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<User[]>([])
  const [error, setError] = useState<string | null>(null)

  const usersQuery = useQuery({
    queryKey: ['users-search-group', query],
    enabled: query.trim().length >= 2,
    queryFn: () => api.searchUsers(accessToken, query.trim()),
  })

  const selectedIds = useMemo(
    () => new Set(selected.map((user) => user.id)),
    [selected],
  )

  const createMutation = useMutation({
    mutationFn: () =>
      api.createGroup(
        accessToken,
        title.trim(),
        selected.map((user) => user.username),
      ),
    onSuccess: (conversation) => {
      onCreated(conversation)
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create group')
    },
  })

  function toggleUser(user: User) {
    setSelected((current) =>
      current.some((item) => item.id === user.id)
        ? current.filter((item) => item.id !== user.id)
        : [...current, user],
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-1)] shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[var(--accent)]" />
            <h3 className="text-sm font-semibold">New group</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3 overflow-y-auto p-4">
          <Input
            placeholder="Group name"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={64}
          />
          <Input
            placeholder="Search people to add"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          {selected.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selected.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent)]"
                  onClick={() => toggleUser(user)}
                >
                  {user.displayName}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          ) : null}

          <div className="max-h-56 space-y-1 overflow-y-auto">
            {(usersQuery.data ?? []).map((user) => {
              const isSelected = selectedIds.has(user.id)
              return (
                <button
                  key={user.id}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-[var(--surface-2)]',
                    isSelected && 'bg-[var(--accent-soft)]',
                  )}
                  onClick={() => toggleUser(user)}
                >
                  <UserAvatar name={user.displayName} avatarUrl={user.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{user.displayName}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">
                      @{user.username}
                    </p>
                  </div>
                  {isSelected ? <Check className="h-4 w-4 text-[var(--accent)]" /> : null}
                </button>
              )
            })}
            {query.trim().length >= 2 &&
            !usersQuery.isFetching &&
            (usersQuery.data?.length ?? 0) === 0 ? (
              <p className="px-2 py-4 text-sm text-[var(--text-muted)]">No users found</p>
            ) : null}
          </div>

          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        </div>

        <div className="border-t border-[var(--border)] p-4">
          <Button
            className="w-full"
            disabled={
              createMutation.isPending ||
              title.trim().length < 2 ||
              selected.length < 1
            }
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? 'Creating…' : 'Create group'}
          </Button>
        </div>
      </div>
    </div>
  )
}

