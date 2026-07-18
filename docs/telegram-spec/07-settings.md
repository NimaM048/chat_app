# 07 — Settings

> **MVP Status:** 🟡 Profile edit (displayName, username, avatar) exists. ⛔ Most privacy, devices, folders, data/storage, appearance deep settings, proxy, passcode, 2FA UI.

Settings is a hub of many screens. Each screen below includes the required behavioral contract. Shared chrome: back button, title, scrollable sections with group headers, destructive rows in danger color.

---

## 1. Settings Hub

### Purpose
Entry to all preferences and account management.

### UI Layout
- Profile header card (avatar, name, phone/email, username) → Edit profile.
- Sections list:
  1. Account / My Account
  2. Privacy and Security
  3. Notifications and Sounds
  4. Data and Storage
  5. Chat Settings / Appearance
  6. Folders
  7. Devices
  8. Language
  9. Advanced
  10. Accessibility / Power Saving
  11. Calls (when enabled)
  12. Stickers and Emoji
  13. Ask a Question / FAQ link
  14. Log out

### UX
- Desktop: settings can replace conversation pane or open as route `#/settings`.
- Search settings (optional power feature): filter rows by keyword.

---

## 2. Edit Profile / My Account

### Fields
- Avatar (upload/remove)
- Display name / First + Last
- Bio (≤70–140 chars; our default **70**)
- Username
- Phone (change flow — see auth)
- Birthday (optional, privacy gated)
- Personal channel link (optional deferred)

### API
```http
PATCH /api/v1/users/me
{ "displayName": "...", "bio": "...", "username": "...", "birthday": "2000-01-01" }
POST /api/v1/users/me/avatar  (multipart or upload id)
DELETE /api/v1/users/me/avatar
```

### Validation
Username pattern; reserved names; rate limit username changes (e.g. 1/week soft).

### Edge Cases
Avatar moderation reject; username race.

> **MVP Status:** 🟡 name/username/avatar without bio/birthday.

---

## 3. Privacy and Security

### Last Seen & Online
Options: Everybody / Contacts / Nobody / (Exceptions allow/deny lists).

### Profile Photo / Bio / Phone / Forwards / Calls / Groups & Channels / Voice messages / Messages (who can message you)
Same visibility enum pattern.

### UI
Each row opens radio list + exception management (Add users/groups).

### DB
```prisma
model PrivacySetting {
  userId String
  field  String  // LAST_SEEN, PHONE, AVATAR, FORWARDS, CALLS, GROUPS, VOICE, MESSAGES, BIO
  visibility String // EVERYONE CONTACTS NOBODY
  @@id([userId, field])
}
model PrivacyException {
  id String @id
  userId String
  field String
  peerId String
  kind String // ALLOW DENY
}
```

### Blocked Users
List → unblock. Block from profile also lands here.

### Passcode Lock (local)
Client-side PIN/biometrics to open app; not server password.

### Two-Step Verification
Enable/disable cloud password; hint; recovery email — see `01-authentication.md`.

### Active Sessions
Link to Devices.

### Delete Account / Self-destruct inactivity
- Delete now with confirm + password.
- Auto-delete account after N months inactivity (Telegram-like): setting 1–24 months.

### API
```http
GET/PATCH /api/v1/users/me/privacy
GET/POST/DELETE /api/v1/users/me/blocks
POST /api/v1/users/me/delete { "confirm": "DELETE", "password": "..." }
```

---

## 4. Notifications and Sounds

See also `10-notifications.md`.

### Global toggles
- Show notifications
- Message preview
- Sound / name / vibration (platform)
- Badge count include muted? default exclude muted unread from badge optional setting
- Priority / importance (Android channels)

### Exceptions
Per-chat custom notification settings from chat menu sync here as list.

### Stories / Calls / Channels groups sections
Separate subsections when features exist.

---

## 5. Data and Storage

### Auto-download
Matrix: Photos / Videos / Files / Voice × Wi-Fi / Mobile / Roaming — On/Off + max size.

### Storage usage
Categories with Clear cache / Clear for chat.

### Save to gallery
On/Off for photos/videos.

### Reset download settings

### API / local
Mostly client policy; server may store preferences.

```http
PATCH /api/v1/users/me/preferences { "autoDownload": { ... }, "cacheLimitMb": 2048 }
```

---

## 6. Chat Settings / Appearance

### Theme
System / Light / Dark / Custom themes (accent color).

### Accent
Telegram blue default `#2AABEE`; user swatches.

### Chat wallpaper
Solid / pattern / image upload per-chat or global.

### Text size
Slider affecting message font; bubble width feel.

### Bubble corners radius

### Sticker/emoji size

### Animations
Enabled / Power saving / Reduce (sync OS reduced motion).

### Send with Enter

### Distances / date format

Design tokens: `21-design-system.md`.

---

## 7. Folders Settings

Create/edit/delete folders; recommend folders; include/exclude chats; order tabs. See `03-chat-list.md`.

---

## 8. Language

- List of locales; search; download language pack if remote.
- Pseudo-RTL debug option in Advanced.

```http
PATCH /api/v1/users/me/preferences { "language": "fa" }
```

---

## 9. Devices / Sessions

See `01-authentication.md` §Sessions. Show app version, IP, location approx, Terminate.

---

## 10. Advanced

- Experimental flags
- Debug logs export
- Connection type
- TCP/WS only (if ever relevant)
- Power user: spoof timezone? no
- Flush DNS / reset account local DB

---

## 11. Proxy / Connection

Telegram supports SOCKS5/MTProto proxy. **Our app:**
- Document HTTP(S)/SOCKS5 system proxy honor on Desktop.
- Custom in-app proxy: Phase 10 optional for censored networks.
- Show current DC/region only if multi-region infra exists.

---

## 12. Calls Settings

- Peer-to-peer: Always / Contacts / Never (privacy + relay cost)
- Noise cancellation
- Using less data

---

## 13. Accessibility / Power Saving

- High contrast (optional)
- Reduce motion
- Autoplay media off
- Large emoji
- Screen reader tips link
- Animation level

---

## 14. Stickers and Emoji

- Installed packs list; archive; reorder
- Suggest stickers while typing
- Loop animated stickers
- Emoji status (deferred Premium-like)

---

## 15. Premium Features (Telegram parity note)

Telegram Premium gates many extras. **Our decision:** do not clone Premium monetization in MVP roadmap; implement useful features as free unless business later requires tiers. Mark gated Telegram-only behaviors as **N/A**.

---

## 16. Cross-Cutting Requirements

### Backend
`UserPreference` JSON document or normalized columns; privacy tables; sessions.

### Realtime
`preferences:updated` / `privacy:updated` to other devices.

### Permissions
Only self; 2FA required for delete account / disable 2FA.

### Validation
Enum fields; bio length; language BCP-47.

### Accessibility
Settings rows as buttons with `aria-current` on hub; toggles use switch role.

### Mobile vs Desktop
- Mobile: full-screen push stack.
- Desktop: wide list + detail split optional.

### Animation
Row chevron navigations standard push; toggles 120ms.

### Loading / Empty / Error
Skeleton hub; empty blocked list; save errors toast with retry.

---

## 17. Testing Checklist

- [ ] Profile update syncs to other clients
- [ ] Privacy last seen buckets enforced in API
- [ ] Block prevents messaging
- [ ] Theme persists
- [ ] Folder CRUD
- [ ] Terminate session
- [ ] Logout

---

*End of 07-settings.md*
