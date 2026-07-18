import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import {
  SettingsPageShell,
  SettingsSection,
  SettingsActionRow,
} from '@/components/settings/settings-ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserAvatar } from '@/components/ui/user-avatar'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

export function SettingsAccountPage() {
  const user = useAuthStore((s) => s.user)!
  const accessToken = useAuthStore((s) => s.accessToken)!
  const setUser = useAuthStore((s) => s.setUser)
  const clearSession = useAuthStore((s) => s.clearSession)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [displayName, setDisplayName] = useState(user.displayName)
  const [username, setUsername] = useState(user.username)
  const [bio, setBio] = useState(user.bio ?? '')
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')

  const saveMutation = useMutation({
    mutationFn: () =>
      api.updateProfile(accessToken, {
        displayName: displayName.trim(),
        username: username.trim(),
        bio: bio.trim() || null,
        avatarUrl,
      }),
    onSuccess: (updated) => {
      setUser(updated)
      setError(null)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1500)
    },
    onError: (err: Error) => setError(err.message),
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.upload(accessToken, file, file.name),
    onSuccess: (uploaded) => setAvatarUrl(uploaded.url),
    onError: (err: Error) => setError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteAccount(accessToken, deletePassword),
    onSuccess: () => {
      clearSession()
      window.location.href = '/login'
    },
    onError: (err: Error) => setError(err.message),
  })

  return (
    <SettingsPageShell
      title="My Account"
      action={
        <Button
          type="button"
          variant="ghost"
          className="mr-1 h-9 px-3 text-[var(--accent)]"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? '…' : saved ? 'Done' : 'Save'}
        </Button>
      }
    >
      <SettingsSection>
        <div className="flex flex-col items-center gap-3 px-4 py-6">
          <div className="relative">
            <UserAvatar
              name={displayName || user.displayName}
              avatarUrl={avatarUrl}
              className="h-24 w-24"
              fallbackClassName="text-2xl"
            />
            <button
              type="button"
              className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow"
              onClick={() => fileRef.current?.click()}
              aria-label="Change photo"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) uploadMutation.mutate(file)
              }}
            />
          </div>
          <p className="text-[13px] text-[var(--text-muted)]">
            {uploadMutation.isPending ? 'Uploading…' : 'Set Profile Photo'}
          </p>
        </div>
      </SettingsSection>

      <SettingsSection title="Profile info">
        <div className="space-y-4 px-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={64}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Input
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 70))}
              placeholder="Add a few words about yourself"
              maxLength={70}
            />
            <p className="text-right text-[12px] text-[var(--text-muted)]">
              {bio.length}/70
            </p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Username"
        footer="You can choose a username on Chat App. If you do, people will be able to find you by this username and contact you without knowing your email."
      >
        <div className="px-4 py-3">
          <div className="flex items-center gap-1 rounded-xl bg-[var(--surface-2)] px-3 py-2">
            <span className="text-[var(--text-muted)]">@</span>
            <input
              className="w-full bg-transparent text-[16px] outline-none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={32}
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Account">
        <SettingsActionRow label="Email" value={user.email} />
        <SettingsActionRow
          label="Delete Account"
          danger
          description="This will permanently delete your account and all data."
          onClick={() => {
            setDeleteOpen(true)
            setDeletePassword('')
            setError(null)
          }}
        />
      </SettingsSection>

      {deleteOpen ? (
        <SettingsSection
          title="Confirm deletion"
          footer="Enter your password to permanently delete this account. This cannot be undone."
        >
          <div className="space-y-3 px-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="delete-password">Password</Label>
              <Input
                id="delete-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 bg-[var(--danger)] text-white hover:opacity-90"
                disabled={deleteMutation.isPending || deletePassword.length < 8}
                onClick={() => {
                  if (
                    window.confirm(
                      'Delete your account permanently? This cannot be undone.',
                    )
                  ) {
                    deleteMutation.mutate()
                  }
                }}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete forever'}
              </Button>
            </div>
          </div>
        </SettingsSection>
      ) : null}

      {error ? (
        <p className="px-4 pb-4 text-sm text-[var(--danger)]">{error}</p>
      ) : null}
    </SettingsPageShell>
  )
}
