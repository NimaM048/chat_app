import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type PrivacyVisibility = 'EVERYONE' | 'CONTACTS' | 'NOBODY'
export type PrivacyField =
  | 'LAST_SEEN'
  | 'PROFILE_PHOTO'
  | 'BIO'
  | 'PHONE'
  | 'FORWARDS'
  | 'CALLS'
  | 'GROUPS'
  | 'VOICE_MESSAGES'
  | 'MESSAGES'

export interface UserPreferences {
  theme: 'system' | 'light' | 'dark'
  language: string
  sendOnEnter: boolean
  messagePreview: boolean
  desktopNotifications: boolean
  soundEnabled: boolean
  animationLevel: 'full' | 'power-saver' | 'none'
  autoDownloadPhotos: boolean
  autoDownloadVideos: boolean
  autoDownloadFiles: boolean
  saveToGallery: boolean
  fontSize: number
  chatBackground: string | null
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  language: 'en',
  sendOnEnter: true,
  messagePreview: true,
  desktopNotifications: true,
  soundEnabled: true,
  animationLevel: 'full',
  autoDownloadPhotos: true,
  autoDownloadVideos: false,
  autoDownloadFiles: false,
  saveToGallery: false,
  fontSize: 16,
  chatBackground: null,
}

export const DEFAULT_PRIVACY: Record<PrivacyField, PrivacyVisibility> = {
  LAST_SEEN: 'EVERYONE',
  PROFILE_PHOTO: 'EVERYONE',
  BIO: 'EVERYONE',
  PHONE: 'CONTACTS',
  FORWARDS: 'EVERYONE',
  CALLS: 'EVERYONE',
  GROUPS: 'EVERYONE',
  VOICE_MESSAGES: 'EVERYONE',
  MESSAGES: 'EVERYONE',
}

interface PreferencesState {
  preferences: UserPreferences
  privacy: Record<PrivacyField, PrivacyVisibility>
  hydrated: boolean
  setPreferences: (patch: Partial<UserPreferences>) => void
  replacePreferences: (prefs: UserPreferences) => void
  setPrivacyField: (field: PrivacyField, visibility: PrivacyVisibility) => void
  replacePrivacy: (privacy: Record<string, string>) => void
  setHydrated: (value: boolean) => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      preferences: DEFAULT_PREFERENCES,
      privacy: DEFAULT_PRIVACY,
      hydrated: false,
      setPreferences: (patch) =>
        set((state) => ({
          preferences: { ...state.preferences, ...patch },
        })),
      replacePreferences: (preferences) => set({ preferences }),
      setPrivacyField: (field, visibility) =>
        set((state) => ({
          privacy: { ...state.privacy, [field]: visibility },
        })),
      replacePrivacy: (privacy) =>
        set({
          privacy: {
            ...DEFAULT_PRIVACY,
            ...(privacy as Record<PrivacyField, PrivacyVisibility>),
          },
        }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: 'chat-preferences',
      partialize: (state) => ({
        preferences: state.preferences,
        privacy: state.privacy,
      }),
    },
  ),
)

export function privacyLabel(value: PrivacyVisibility) {
  switch (value) {
    case 'EVERYONE':
      return 'Everybody'
    case 'CONTACTS':
      return 'My Contacts'
    case 'NOBODY':
      return 'Nobody'
  }
}
