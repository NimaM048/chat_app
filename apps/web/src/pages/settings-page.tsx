import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import {
  Bell,
  Database,
  Folder,
  Languages,
  LogOut,
  MessageSquare,
  MonitorSmartphone,
  Palette,
  Shield,
  Smile,
  UserRound,
} from 'lucide-react'
import { UserAvatar } from '@/components/ui/user-avatar'
import {
  SettingsNavRow,
  SettingsSection,
} from '@/components/settings/settings-ui'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import {
  privacyLabel,
  usePreferencesStore,
  type UserPreferences,
} from '@/stores/preferences-store'
import { useThemeStore } from '@/stores/theme-store'

function SettingsHub() {
  const user = useAuthStore((state) => state.user)!
  const refreshToken = useAuthStore((state) => state.refreshToken)
  const clearSession = useAuthStore((state) => state.clearSession)
  const preferences = usePreferencesStore((state) => state.preferences)
  const privacy = usePreferencesStore((state) => state.privacy)

  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (refreshToken) await api.logout(refreshToken)
    },
    onSettled: () => clearSession(),
  })

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--surface-2)]">
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-[var(--border)] bg-[var(--sidebar-bg)] px-2">
        <Link
          to="/app"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--accent)] hover:bg-[var(--chat-hover)]"
          aria-label="Back to chats"
        >
          <span className="text-[28px] leading-none">‹</span>
        </Link>
        <h1 className="flex-1 text-[17px] font-medium text-[var(--text-primary)]">
          Settings
        </h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Link
          to="/app/settings/account"
          className="mb-3 flex items-center gap-4 bg-[var(--sidebar-bg)] px-4 py-4 hover:bg-[var(--chat-hover)]"
        >
          <UserAvatar
            name={user.displayName}
            avatarUrl={user.avatarUrl}
            className="h-[64px] w-[64px]"
            fallbackClassName="text-xl"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-medium text-[var(--text-primary)]">
              {user.displayName}
            </p>
            {user.bio ? (
              <p className="mt-0.5 line-clamp-2 text-[14px] text-[var(--text-secondary)]">
                {user.bio}
              </p>
            ) : (
              <p className="mt-0.5 text-[14px] text-[var(--text-muted)]">
                @{user.username}
              </p>
            )}
            <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">
              {user.email}
            </p>
          </div>
          <span className="text-[22px] text-[var(--text-muted)] opacity-50">›</span>
        </Link>

        <SettingsSection>
          <SettingsNavRow
            to="/app/settings/account"
            icon={UserRound}
            color="#3390ec"
            label="My Account"
          />
          <SettingsNavRow
            to="/app/settings/notifications"
            icon={Bell}
            color="#e53935"
            label="Notifications and Sounds"
          />
          <SettingsNavRow
            to="/app/settings/privacy"
            icon={Shield}
            color="#fb8c00"
            label="Privacy and Security"
            value={privacyLabel(privacy.LAST_SEEN)}
          />
          <SettingsNavRow
            to="/app/settings/data"
            icon={Database}
            color="#43a047"
            label="Data and Storage"
          />
          <SettingsNavRow
            to="/app/settings/chat"
            icon={Palette}
            color="#8e24aa"
            label="Chat Settings"
            value={
              preferences.theme === 'dark'
                ? 'Dark'
                : preferences.theme === 'light'
                  ? 'Light'
                  : 'System'
            }
          />
          <SettingsNavRow
            to="/app/settings/folders"
            icon={Folder}
            color="#039be5"
            label="Folders"
          />
        </SettingsSection>

        <SettingsSection>
          <SettingsNavRow
            to="/app/settings/devices"
            icon={MonitorSmartphone}
            color="#00897b"
            label="Devices"
          />
          <SettingsNavRow
            to="/app/settings/language"
            icon={Languages}
            color="#5e35b1"
            label="Language"
            value={preferences.language === 'fa' ? 'فارسی' : 'English'}
          />
          <SettingsNavRow
            to="/app/settings/stickers"
            icon={Smile}
            color="#fdd835"
            label="Stickers and Emoji"
          />
        </SettingsSection>

        <SettingsSection>
          <SettingsNavRow
            to="/app/settings/advanced"
            icon={MessageSquare}
            color="#546e7a"
            label="Advanced"
          />
        </SettingsSection>

        <SettingsSection>
          <button
            type="button"
            onClick={() => logoutMutation.mutate()}
            className="flex w-full items-center gap-3 px-4 py-[11px] text-left hover:bg-[var(--chat-hover)]"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--danger)] text-white">
              <LogOut className="h-4 w-4" />
            </span>
            <span className="text-[16px] text-[var(--danger)]">Log Out</span>
          </button>
        </SettingsSection>

        <p className="px-4 pb-8 pt-2 text-center text-[13px] text-[var(--text-muted)]">
          Chat App for Web
        </p>
      </div>
    </div>
  )
}

export function SettingsPage() {
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const accessToken = useAuthStore((state) => state.accessToken)
  const setTheme = useThemeStore((state) => state.setTheme)
  const replacePreferences = usePreferencesStore((s) => s.replacePreferences)
  const replacePrivacy = usePreferencesStore((s) => s.replacePrivacy)
  const setHydrated = usePreferencesStore((s) => s.setHydrated)
  const preferences = usePreferencesStore((s) => s.preferences)

  const prefsQuery = useQuery({
    queryKey: ['preferences'],
    enabled: Boolean(accessToken),
    queryFn: () => api.getPreferences(accessToken!),
  })

  const privacyQuery = useQuery({
    queryKey: ['privacy'],
    enabled: Boolean(accessToken),
    queryFn: () => api.getPrivacy(accessToken!),
  })

  useEffect(() => {
    if (prefsQuery.data) {
      const { updatedAt: _u, ...prefs } = prefsQuery.data as UserPreferences & {
        updatedAt?: string
      }
      replacePreferences(prefs as UserPreferences)
      setHydrated(true)
      if (prefs.theme === 'light' || prefs.theme === 'dark') {
        setTheme(prefs.theme)
      } else if (prefs.theme === 'system') {
        const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
        setTheme(dark ? 'dark' : 'light')
      }
    }
  }, [prefsQuery.data, replacePreferences, setHydrated, setTheme])

  useEffect(() => {
    if (privacyQuery.data) replacePrivacy(privacyQuery.data)
  }, [privacyQuery.data, replacePrivacy])

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--chat-font-size',
      `${preferences.fontSize}px`,
    )
  }, [preferences.fontSize])

  if (!user || !accessToken) {
    return <Navigate to="/login" replace />
  }

  const isHub = location.pathname === '/app/settings'

  return (
    <div className="mx-auto flex h-screen w-full max-w-[480px] flex-col bg-[var(--sidebar-bg)] shadow-[var(--shadow-soft)] md:border-x md:border-[var(--border)]">
      {isHub ? <SettingsHub /> : <Outlet />}
    </div>
  )
}
