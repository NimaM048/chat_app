# 09 — Profile

> **MVP Status:** 🟡 Settings profile edit + chat info sheet partial. Full peer profile with shared media tabs, privacy-gated phone, common groups, block/report flows incomplete.

---

## 1. Purpose

Profiles answer “who is this?” and provide actions (message, call, mute, block) plus shared content browser.

---

## 2. Peer User Profile

### UI Layout
1. Large avatar (tap → media viewer).
2. Display name + badges (verified/bot/scam).
3. Username `@name` (copy).
4. Bio.
5. Info rows: mobile (if allowed), timezone/birthday optional.
6. Notifications row (mute presets).
7. Actions: Message, Call, Video, Mute, Search, more…
8. Tabs: Media | Files | Links | Voice | GIFs | Groups in common.

### UX
- Message → open/create DIRECT conversation.
- Block → confirm → privacy enforce.
- Report → reason picker → submit.
- Add contact → Contact table.
- Share contact → send CONTACT message.

### API
```http
GET /api/v1/users/:idOrUsername
GET /api/v1/users/:id/common-groups
GET /api/v1/conversations/:id/shared?type=media|files|links|voice&cursor=
POST /api/v1/users/:id/block
POST /api/v1/users/:id/report { "reason": "spam", "messageIds": [] }
POST /api/v1/contacts { "userId": "..." }
```

### Privacy enforcement
Phone/avatar/lastSeen hidden per settings; API redacts fields.

### Edge Cases
Deleted user; username changed mid-view; you are blocked (limited profile); bot profile shows “Open bot” / commands.

---

## 3. My Profile

Same as edit settings; QR of username link; presence “online” always to self.

---

## 4. Group Profile

- Title, member count, description, invite link (if allowed).
- Members preview.
- Actions: Add member, Mute, Leave, Report, Permissions (admin).
- Shared media tabs.
- See `05-groups.md`.

---

## 5. Channel Profile

- Subscribers count; Join/Leave; Mute; Discussion link; Admin tools; Stats.
- See `06-channels.md`.

---

## 6. States / A11y / Platforms / Animation

- Loading skeleton header; empty shared tabs; error retry.
- Avatar button labelled; tabs arrow-keyable.
- Mobile: full-screen sheet; Desktop: side panel 360px.
- Hero avatar parallax subtle optional; tab underline 200ms.

---

## 7. Realtime

`user:updated` for name/avatar; `conversation:updated` for group/channel meta.

---

## 8. Testing

- [ ] Phone hidden when privacy NOBODY
- [ ] Block removes ability to message
- [ ] Shared media pagination
- [ ] Common groups only mutual

---

*End of 09-profile.md*
