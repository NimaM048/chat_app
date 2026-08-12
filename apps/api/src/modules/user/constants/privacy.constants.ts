export const PRIVACY_FIELDS = [
  'LAST_SEEN',
  'PROFILE_PHOTO',
  'BIO',
  'PHONE',
  'FORWARDS',
  'CALLS',
  'GROUPS',
  'VOICE_MESSAGES',
  'MESSAGES',
] as const;

export type PrivacyField = (typeof PRIVACY_FIELDS)[number];

export const PRIVACY_VISIBILITIES = ['EVERYONE', 'CONTACTS', 'NOBODY'] as const;

export type PrivacyVisibility = (typeof PRIVACY_VISIBILITIES)[number];

export type PeerUserView = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio?: string | null;
  lastSeenAt?: string | null;
  isOnline?: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
};
