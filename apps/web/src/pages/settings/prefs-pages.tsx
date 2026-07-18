import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MonitorSmartphone, Trash2 } from 'lucide-react'
import {
  SettingsPageShell,
  SettingsRadioRow,
  SettingsSection,
  SettingsSwitchRow,
} from '@/components/settings/settings-ui'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { usePreferencesStore } from '@/stores/preferences-store'
import { useThemeStore } from '@/stores/theme-store'

function usePrefPatch() {
  const accessToken = useAuthStore((s) => s.accessToken)!
  const setPreferences = usePreferencesStore((s) => s.setPreferences)
  return useMutation({
    mutationFn: async (patch: Parameters<typeof setPreferences>[0]) => {
      setPreferences(patch)
      return api.updatePreferences(accessToken, patch)
    },
    onSuccess: (data) => {
      const { updatedAt: _u, ...prefs } = data as typeof data & {
        updatedAt?: string
      }
      usePreferencesStore.getState().replacePreferences(prefs)
    },
  })
}

export function SettingsNotificationsPage() {
  const preferences = usePreferencesStore((s) => s.preferences)
  const patch = usePrefPatch()

  return (
    <SettingsPageShell title="Notifications and Sounds">
      <SettingsSection title="Notifications">
        <SettingsSwitchRow
          label="Desktop Notifications"
          description="Show notifications when the app is in the background."
          checked={preferences.desktopNotifications}
          onChange={async (desktopNotifications) => {
            if (desktopNotifications) {
              const { ensureNotificationPermission } = await import(
                '@/lib/notifications'
              )
              await ensureNotificationPermission()
            }
            patch.mutate({ desktopNotifications })
          }}
        />
        <SettingsSwitchRow
          label="Message Preview"
          description="Display message text inside notifications."
          checked={preferences.messagePreview}
          onChange={(messagePreview) => patch.mutate({ messagePreview })}
        />
        <SettingsSwitchRow
          label="Sound"
          checked={preferences.soundEnabled}
          onChange={(soundEnabled) => patch.mutate({ soundEnabled })}
        />
      </SettingsSection>
    </SettingsPageShell>
  )
}

export function SettingsDataPage() {
  const preferences = usePreferencesStore((s) => s.preferences)
  const patch = usePrefPatch()

  return (
    <SettingsPageShell title="Data and Storage">
      <SettingsSection title="Automatic media download">
        <SettingsSwitchRow
          label="Photos"
          checked={preferences.autoDownloadPhotos}
          onChange={(autoDownloadPhotos) => patch.mutate({ autoDownloadPhotos })}
        />
        <SettingsSwitchRow
          label="Videos"
          checked={preferences.autoDownloadVideos}
          onChange={(autoDownloadVideos) => patch.mutate({ autoDownloadVideos })}
        />
        <SettingsSwitchRow
          label="Files"
          checked={preferences.autoDownloadFiles}
          onChange={(autoDownloadFiles) => patch.mutate({ autoDownloadFiles })}
        />
      </SettingsSection>

      <SettingsSection title="Other">
        <SettingsSwitchRow
          label="Save to Gallery"
          description="Automatically save incoming photos and videos."
          checked={preferences.saveToGallery}
          onChange={(saveToGallery) => patch.mutate({ saveToGallery })}
        />
      </SettingsSection>

      <SettingsSection
        title="Storage usage"
        footer="Clearing cache removes temporary media from this device. Your cloud chats stay intact."
      >
        <button
          type="button"
          className="w-full px-4 py-3 text-left text-[16px] text-[var(--accent)] hover:bg-[var(--chat-hover)]"
          onClick={() => {
            if ('caches' in window) {
              void caches.keys().then((keys) =>
                Promise.all(keys.map((key) => caches.delete(key))),
              )
            }
            window.alert('Local cache cleared on this device.')
          }}
        >
          Clear Cache
        </button>
      </SettingsSection>
    </SettingsPageShell>
  )
}

export function SettingsChatPage() {
  const preferences = usePreferencesStore((s) => s.preferences)
  const patch = usePrefPatch()
  const setTheme = useThemeStore((s) => s.setTheme)

  return (
    <SettingsPageShell title="Chat Settings">
      <SettingsSection title="Color theme">
        {(['system', 'light', 'dark'] as const).map((theme) => (
          <SettingsRadioRow
            key={theme}
            label={
              theme === 'system' ? 'System' : theme === 'light' ? 'Day' : 'Night'
            }
            selected={preferences.theme === theme}
            onSelect={() => {
              patch.mutate({ theme })
              if (theme === 'system') {
                const dark = window.matchMedia(
                  '(prefers-color-scheme: dark)',
                ).matches
                setTheme(dark ? 'dark' : 'light')
              } else {
                setTheme(theme)
              }
            }}
          />
        ))}
      </SettingsSection>

      <SettingsSection
        title="Message text size"
        footer="This changes message text size in chats."
      >
        <div className="px-4 py-4">
          <input
            type="range"
            min={12}
            max={24}
            value={preferences.fontSize}
            onChange={(e) => patch.mutate({ fontSize: Number(e.target.value) })}
            className="w-full accent-[var(--accent)]"
          />
          <div className="mt-2 flex justify-between text-[13px] text-[var(--text-muted)]">
            <span>A</span>
            <span style={{ fontSize: preferences.fontSize }}>Preview</span>
            <span className="text-[18px]">A</span>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Keyboard">
        <SettingsSwitchRow
          label="Send with Enter"
          description="Use Shift+Enter for a new line."
          checked={preferences.sendOnEnter}
          onChange={(sendOnEnter) => patch.mutate({ sendOnEnter })}
        />
      </SettingsSection>

      <SettingsSection title="Animations">
        {(['full', 'power-saver', 'none'] as const).map((level) => (
          <SettingsRadioRow
            key={level}
            label={
              level === 'power-saver'
                ? 'Power Saving'
                : level === 'none'
                  ? 'Disabled'
                  : 'Enabled'
            }
            selected={preferences.animationLevel === level}
            onSelect={() => patch.mutate({ animationLevel: level })}
          />
        ))}
      </SettingsSection>
    </SettingsPageShell>
  )
}

function formatRelative(iso: string) {
  const diff = Date.now() - Date.parse(iso)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function SettingsDevicesPage() {
  const accessToken = useAuthStore((s) => s.accessToken)!
  const queryClient = useQueryClient()

  const sessionsQuery = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.listSessions(accessToken),
  })

  const revokeSessionMutation = useMutation({
    mutationFn: (sessionId: string) => api.revokeSession(accessToken, sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })

  const revokeOthersMutation = useMutation({
    mutationFn: () => api.revokeOtherSessions(accessToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })

  return (
    <SettingsPageShell
      title="Devices"
      action={
        <Button
          type="button"
          variant="ghost"
          className="mr-1 h-9 px-2 text-[13px] text-[var(--danger)]"
          disabled={revokeOthersMutation.isPending}
          onClick={() => {
            if (window.confirm('Terminate all other sessions?')) {
              revokeOthersMutation.mutate()
            }
          }}
        >
          Terminate All Others
        </Button>
      }
    >
      <SettingsSection
        title="This device"
        footer="The list of devices where you are logged into Chat App. You can terminate any session remotely."
      >
        {(sessionsQuery.data ?? [])
          .filter((s) => s.isCurrent)
          .map((session) => (
            <div key={session.id} className="flex gap-3 px-4 py-3">
              <MonitorSmartphone className="mt-0.5 h-5 w-5 text-[var(--accent)]" />
              <div>
                <p className="text-[16px] text-[var(--text-primary)]">
                  {session.deviceName || 'This device'}
                </p>
                <p className="text-[13px] text-[var(--text-muted)]">
                  {session.platform || 'web'}
                  {session.ip ? ` · ${session.ip}` : ''}
                </p>
              </div>
            </div>
          ))}
      </SettingsSection>

      <SettingsSection title="Active sessions">
        {(sessionsQuery.data ?? [])
          .filter((s) => !s.isCurrent)
          .map((session) => (
            <div
              key={session.id}
              className="flex items-start gap-3 border-b border-[var(--border)] px-4 py-3 last:border-b-0"
            >
              <MonitorSmartphone className="mt-0.5 h-5 w-5 text-[var(--text-muted)]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] text-[var(--text-primary)]">
                  {session.deviceName || 'Unknown device'}
                </p>
                <p className="text-[13px] text-[var(--text-muted)]">
                  {session.platform || 'web'}
                  {session.ip ? ` · ${session.ip}` : ''} ·{' '}
                  {formatRelative(session.lastActiveAt)}
                </p>
              </div>
              <button
                type="button"
                className="text-[var(--danger)]"
                aria-label="Terminate"
                onClick={() => {
                  if (window.confirm('Terminate this session?')) {
                    revokeSessionMutation.mutate(session.id)
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        {(sessionsQuery.data ?? []).filter((s) => !s.isCurrent).length === 0 ? (
          <p className="px-4 py-6 text-center text-[14px] text-[var(--text-muted)]">
            No other active sessions.
          </p>
        ) : null}
      </SettingsSection>
    </SettingsPageShell>
  )
}

export function SettingsLanguagePage() {
  const preferences = usePreferencesStore((s) => s.preferences)
  const patch = usePrefPatch()

  return (
    <SettingsPageShell title="Language">
      <SettingsSection>
        {[
          { code: 'en', label: 'English' },
          { code: 'fa', label: 'فارسی' },
        ].map((lang) => (
          <SettingsRadioRow
            key={lang.code}
            label={lang.label}
            selected={preferences.language === lang.code}
            onSelect={() => {
              patch.mutate({ language: lang.code })
              document.documentElement.lang = lang.code
              document.documentElement.dir = lang.code === 'fa' ? 'rtl' : 'ltr'
            }}
          />
        ))}
      </SettingsSection>
    </SettingsPageShell>
  )
}

export function SettingsFoldersPage() {
  return (
    <SettingsPageShell title="Folders">
      <SettingsSection
        footer="Create folders for different groups of chats and quickly switch between them."
      >
        <p className="px-4 py-8 text-center text-[15px] text-[var(--text-muted)]">
          No folders yet. Chat folders arrive in the organization phase.
        </p>
        <button
          type="button"
          className="w-full border-t border-[var(--border)] px-4 py-3 text-left text-[16px] text-[var(--accent)] hover:bg-[var(--chat-hover)]"
          onClick={() =>
            window.alert('Folder creation will be enabled with server-side folders.')
          }
        >
          Create New Folder
        </button>
      </SettingsSection>
    </SettingsPageShell>
  )
}

export function SettingsStickersPage() {
  return (
    <SettingsPageShell title="Stickers and Emoji">
      <SettingsSection title="Suggest stickers by emoji">
        <SettingsSwitchRow
          label="Suggest stickers while typing"
          checked
          onChange={() => undefined}
        />
        <SettingsSwitchRow
          label="Loop Animated Stickers"
          checked
          onChange={() => undefined}
        />
        <SettingsSwitchRow
          label="Large Emoji"
          checked
          onChange={() => undefined}
        />
      </SettingsSection>
      <SettingsSection footer="Installed sticker packs will appear here once the sticker platform ships.">
        <p className="px-4 py-8 text-center text-[15px] text-[var(--text-muted)]">
          No sticker packs installed.
        </p>
      </SettingsSection>
    </SettingsPageShell>
  )
}

export function SettingsAdvancedPage() {
  return (
    <SettingsPageShell title="Advanced">
      <SettingsSection title="Connection">
        <SettingsActionLike
          label="Use Less Data for Calls"
          onClick={() => window.alert('Calls arrive in a later phase.')}
        />
      </SettingsSection>
      <SettingsSection title="Experimental">
        <SettingsSwitchRow
          label="Enable experimental features"
          checked={false}
          onChange={() =>
            window.alert('Experimental flags will be wired to remote config.')
          }
        />
      </SettingsSection>
      <SettingsSection>
        <SettingsActionLike
          label="Export Local Logs"
          onClick={() =>
            window.alert('Debug log export is available in desktop builds.')
          }
        />
      </SettingsSection>
    </SettingsPageShell>
  )
}

function SettingsActionLike({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center border-b border-[var(--border)] px-4 py-3 text-left text-[16px] text-[var(--text-primary)] last:border-b-0 hover:bg-[var(--chat-hover)]"
    >
      {label}
    </button>
  )
}
