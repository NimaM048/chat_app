import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  SettingsPageShell,
  SettingsRadioRow,
  SettingsSection,
  SettingsActionRow,
} from '@/components/settings/settings-ui'
import { UserAvatar } from '@/components/ui/user-avatar'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import {
  privacyLabel,
  usePreferencesStore,
  type PrivacyField,
  type PrivacyVisibility,
} from '@/stores/preferences-store'

const PRIVACY_ROWS: Array<{ field: PrivacyField; label: string; to: string }> = [
  { field: 'LAST_SEEN', label: 'Last Seen & Online', to: 'last-seen' },
  { field: 'PROFILE_PHOTO', label: 'Profile Photos', to: 'profile-photo' },
  { field: 'BIO', label: 'Bio', to: 'bio' },
  { field: 'PHONE', label: 'Email / Phone', to: 'phone' },
  { field: 'FORWARDS', label: 'Forwarded Messages', to: 'forwards' },
  { field: 'CALLS', label: 'Calls', to: 'calls' },
  { field: 'GROUPS', label: 'Groups & Channels', to: 'groups' },
  { field: 'VOICE_MESSAGES', label: 'Voice Messages', to: 'voice' },
  { field: 'MESSAGES', label: 'Messages', to: 'messages' },
]

export function SettingsPrivacyPage() {
  const privacy = usePreferencesStore((s) => s.privacy)

  return (
    <SettingsPageShell title="Privacy and Security">
      <SettingsSection title="Who can see my personal info">
        {PRIVACY_ROWS.map((row) => (
          <Link
            key={row.field}
            to={`/app/settings/privacy/${row.to}`}
            className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 last:border-b-0 hover:bg-[var(--chat-hover)]"
          >
            <span className="min-w-0 flex-1 text-[16px] text-[var(--text-primary)]">
              {row.label}
            </span>
            <span className="text-[15px] text-[var(--accent)]">
              {privacyLabel(privacy[row.field])}
            </span>
            <span className="text-[var(--text-muted)] opacity-50">›</span>
          </Link>
        ))}
      </SettingsSection>

      <SettingsSection title="Security">
        <SettingsActionRow
          label="Two-Step Verification"
          value="Off"
          description="Set an additional password for your account."
          onClick={() =>
            window.alert('Two-step verification arrives with phone OTP auth.')
          }
        />
        <Link
          to="/app/settings/devices"
          className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 hover:bg-[var(--chat-hover)]"
        >
          <div>
            <p className="text-[16px] text-[var(--text-primary)]">
              Active Sessions
            </p>
            <p className="text-[13px] text-[var(--text-muted)]">
              Manage devices where you are logged in.
            </p>
          </div>
          <span className="text-[var(--text-muted)] opacity-50">›</span>
        </Link>
      </SettingsSection>

      <SettingsSection title="Blocked users">
        <Link
          to="/app/settings/privacy/blocked"
          className="flex items-center justify-between px-4 py-3 hover:bg-[var(--chat-hover)]"
        >
          <span className="text-[16px] text-[var(--text-primary)]">
            Blocked Users
          </span>
          <span className="text-[var(--text-muted)] opacity-50">›</span>
        </Link>
      </SettingsSection>
    </SettingsPageShell>
  )
}

const FIELD_BY_SLUG: Record<string, PrivacyField> = {
  'last-seen': 'LAST_SEEN',
  'profile-photo': 'PROFILE_PHOTO',
  bio: 'BIO',
  phone: 'PHONE',
  forwards: 'FORWARDS',
  calls: 'CALLS',
  groups: 'GROUPS',
  voice: 'VOICE_MESSAGES',
  messages: 'MESSAGES',
}

const TITLE_BY_FIELD: Record<PrivacyField, string> = {
  LAST_SEEN: 'Last Seen & Online',
  PROFILE_PHOTO: 'Profile Photos',
  BIO: 'Bio',
  PHONE: 'Email / Phone',
  FORWARDS: 'Forwarded Messages',
  CALLS: 'Calls',
  GROUPS: 'Groups & Channels',
  VOICE_MESSAGES: 'Voice Messages',
  MESSAGES: 'Messages',
}

export function SettingsPrivacyFieldPage({ slug }: { slug: string }) {
  const accessToken = useAuthStore((s) => s.accessToken)!
  const field = FIELD_BY_SLUG[slug]
  const privacy = usePreferencesStore((s) => s.privacy)
  const setPrivacyField = usePreferencesStore((s) => s.setPrivacyField)

  const mutation = useMutation({
    mutationFn: (visibility: PrivacyVisibility) =>
      api.updatePrivacy(accessToken, field, visibility),
    onMutate: (visibility) => setPrivacyField(field, visibility),
    onSuccess: (data) => {
      usePreferencesStore.getState().replacePrivacy(data)
    },
  })

  if (!field) {
    return (
      <SettingsPageShell title="Privacy">
        <p className="p-4 text-sm text-[var(--text-muted)]">Unknown setting.</p>
      </SettingsPageShell>
    )
  }

  const options: PrivacyVisibility[] = ['EVERYONE', 'CONTACTS', 'NOBODY']

  return (
    <SettingsPageShell
      title={TITLE_BY_FIELD[field]}
      backTo="/app/settings/privacy"
    >
      <SettingsSection
        title="Who can see this"
        footer="You can change who sees this information at any time."
      >
        {options.map((option) => (
          <SettingsRadioRow
            key={option}
            label={privacyLabel(option)}
            selected={privacy[field] === option}
            onSelect={() => mutation.mutate(option)}
          />
        ))}
      </SettingsSection>
    </SettingsPageShell>
  )
}

export function SettingsBlockedPage() {
  const accessToken = useAuthStore((s) => s.accessToken)!
  const queryClient = useQueryClient()

  const blocksQuery = useQuery({
    queryKey: ['blocks'],
    queryFn: () => api.listBlocks(accessToken),
  })

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => api.unblockUser(accessToken, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['blocks'] })
    },
  })

  return (
    <SettingsPageShell title="Blocked Users" backTo="/app/settings/privacy">
      <SettingsSection footer="Blocked users can't message you or see your last seen status.">
        {(blocksQuery.data ?? []).length === 0 ? (
          <p className="px-4 py-8 text-center text-[15px] text-[var(--text-muted)]">
            You haven&apos;t blocked anyone yet.
          </p>
        ) : (
          (blocksQuery.data ?? []).map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 last:border-b-0"
            >
              <UserAvatar
                name={row.user.displayName}
                avatarUrl={row.user.avatarUrl}
                className="h-10 w-10"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] text-[var(--text-primary)]">
                  {row.user.displayName}
                </p>
                <p className="text-[13px] text-[var(--text-muted)]">
                  @{row.user.username}
                </p>
              </div>
              <button
                type="button"
                className="text-[15px] text-[var(--accent)]"
                onClick={() => unblockMutation.mutate(row.user.id)}
              >
                Unblock
              </button>
            </div>
          ))
        )}
      </SettingsSection>
    </SettingsPageShell>
  )
}
