# 05 — Groups

> **MVP Status:** 🟡 Basic group create + multi-member messaging exists. ⛔ Roles, admin permissions, invite links, join requests, slow mode, history visibility, public usernames, topics/forum mode, ban/restrict tools.

---

## 1. Purpose

Groups are many-to-many conversations for teams, communities, and friends. Telegram’s model scales from small private groups to 200k-member supergroups with fine-grained admin tools. Our product mirrors that ladder: start simple, grow into permissioned communities.

**Why:** One thread with shared context beats dozens of DMs.  
**Pros:** Rich collaboration; admin tooling; invite links.  
**Cons:** Moderation burden; notification noise (mute/slow mode mitigate).  
**Improvements:** Clearer permission presets; better onboarding for new admins.

---

## 2. Group Creation

### UI Layout — Wizard
1. **Add members** — searchable contacts/users multi-select.
2. **Name + avatar** — title required; photo optional.
3. **Create** → open group conversation.

Optional later step: make public username / history visible.

### User Flow
1. Compose (+) → New group.
2. Select ≥1 member (or allow create empty then invite — **Telegram requires members**; we allow 1+ including creator alone for “notes group”? Prefer creator auto-member + ≥0 others).
3. Set title (1–255 chars).
4. `POST /conversations/group` → navigate to chat.

### API
```http
POST /api/v1/conversations/group
{
  "title": "Design Team",
  "memberIds": ["uuid"...],
  "avatarUploadId": "uuid?"
}
```

### Database
- `Conversation.type = GROUP`
- Creator `role = OWNER`
- Members `role = MEMBER`
- Default permissions JSON on conversation

### Edge Cases
- Duplicate members ignored.
- Blocked users skipped with toast.
- Title empty → validation error.
- Avatar MIME/size validation.

### Animation
- Wizard page transitions 240ms; success opens chat with welcome service message.

> **MVP Status:** ✅ Basic create.

---

## 3. Roles & Ownership

| Role | Capabilities (default) |
|------|------------------------|
| OWNER | All permissions; transfer ownership; delete group |
| ADMIN | Subset granted by owner/admins with `canAddAdmins` |
| MEMBER | Default member permissions |
| RESTRICTED | Explicitly limited (can’t send media etc.) |
| BANNED | Not a member; ban record with until date |

### Ownership transfer
1. Owner selects admin → Transfer ownership → confirm.
2. Former owner becomes admin with full rights.
3. Service message emitted.

### API
```http
POST /api/v1/groups/:id/transfer-ownership { "newOwnerId": "..." }
PATCH /api/v1/groups/:id/members/:userId { "role": "ADMIN", "permissions": { ... } }
```

---

## 4. Permissions Matrix

Stored as booleans on `Conversation.defaultMemberPermissions` and overrides on `ConversationMember.permissions` / admin rights on `ConversationMember.adminPermissions`.

**Member defaults (can be toggled by admins):**
- `canSendMessages`
- `canSendMedia`
- `canSendStickers` / `canSendGifs` / `canSendPolls` / `canSendVoice`
- `canPreviewLinks`
- `canAddUsers`
- `canPinMessages`
- `canChangeInfo`

**Admin rights:**
- `canChangeInfo`, `canDeleteMessages`, `canBanUsers`, `canInviteUsers`, `canPinMessages`, `canManageVideoChats`, `canAnonymous`, `canAddAdmins`, `canManageTopics`

### UI — Edit permissions
- Group info → Permissions / Administrators.
- Toggles with confirm for destructive defaults.
- Slow mode selector: Off, 10s, 30s, 1m, 5m, 15m, 1h.

### Backend enforcement
Every send/edit/pin/invite checks role + flags; return `403 FORBIDDEN_GROUP_PERMISSION`.

### Realtime
`group:permissions_updated` → clients update composer read-only state.

---

## 5. Invite Links

### Purpose
Join without knowing phone/username; controllable access.

### Types
- **Primary invite link** — permanent, regenerable (invalidates old).
- **Additional links** — name, expireAt, maxUses, requestApproval, creates join request.

### UI
Group info → Invite links → list + Create + Revoke + Copy + QR.

### API
```http
GET /api/v1/groups/:id/invite-links
POST /api/v1/groups/:id/invite-links
{ "name": "Event", "expiresAt": null, "maxUses": 100, "createsJoinRequest": false }
POST /api/v1/groups/:id/invite-links/primary/revoke
POST /api/v1/invites/:code/join
GET /api/v1/invites/:code  // preview
```

### DB
```prisma
model InviteLink {
  id             String @id
  conversationId String
  code           String @unique
  createdById    String
  isPrimary      Boolean @default(false)
  name           String?
  expiresAt      DateTime?
  maxUses        Int?
  useCount       Int @default(0)
  createsJoinRequest Boolean @default(false)
  revokedAt      DateTime?
}
```

### Edge Cases
- Expired / maxed / revoked → error UI.
- Already member → open chat.
- Ban prevents join.
- Join request path creates `JoinRequest` row.

---

## 6. Join Requests

### UI
Admin badge in group info / pending list; Approve / Decline; Approve all.

### API
```http
GET /api/v1/groups/:id/join-requests
POST /api/v1/groups/:id/join-requests/:userId/approve
POST /api/v1/groups/:id/join-requests/:userId/decline
```

### Realtime
`group:join_request` to admins; `group:member_added` on approve.

---

## 7. Member Management

### UI — Members list
Searchable; role badges; tap → profile; admin actions: Promote, Restrict, Ban, Remove.

### Ban / Kick
- Kick = remove membership.
- Ban = remove + `Ban` record preventing rejoin via links until `until` or forever.

### Restrict
- Temporary permission overrides with expiry (Telegram “restrict user”).

### Mute member (admin)
- Separate from personal notification mute; prevents member from speaking if mapped to restrict `canSendMessages=false`.

### API
```http
DELETE /api/v1/groups/:id/members/:userId
POST /api/v1/groups/:id/members/:userId/ban { "until": null, "reason": "" }
POST /api/v1/groups/:id/members/:userId/restrict { "permissions": {}, "until": "..." }
```

### Edge Cases
- Can’t ban owner; can’t demote last owner.
- Admin can’t modify higher privilege admin unless owner.
- Leaving as owner requires transfer first.

---

## 8. Slow Mode

### Purpose
Rate-limit member sends in large/active groups.

### Behavior
- After send, composer shows countdown; server rejects early sends with `SLOW_MODE` + `retryAfterSec`.
- Admins/owner exempt (configurable).

### DB
`Conversation.slowModeSeconds Int @default(0)`

### Redis
`slow:{convId}:{userId}` TTL = remaining cooldown.

---

## 9. History Visibility

### Purpose
Control whether new members see older messages.

### Options
- Visible history (default for many groups)
- Hidden — new members only see messages after join

### Enforcement
Message list queries filter `createdAt >= member.joinedAt` when history hidden.

### UI
Group settings toggle “Chat history for new members”.

---

## 10. Public vs Private

| | Private | Public |
|--|---------|--------|
| Discoverable | Invite / add only | Username search + `t.me/like` link |
| Username | none | unique `^[a-zA-Z][a-zA-Z0-9_]{4,31}$` |
| Join | invite/add | join by username + optional join request |

### API
```http
PATCH /api/v1/groups/:id
{ "username": "designteam", "isPublic": true, "historyVisible": true, "title": "...", "description": "..." }
```

---

## 11. Topics / Forum Mode (Supergroup)

### Purpose
Split large communities into topic threads (Telegram forum groups).

### UI
- Topic list pane or tabs; General topic default.
- Each topic has own message thread id.

### DB
```prisma
model Topic {
  id String @id
  conversationId String
  title String
  iconColor Int?
  iconEmojiId String?
  order Int
  isClosed Boolean @default(false)
  messageThreadId BigInt // or uuid
}
Message.topicId String?
```

### Decision
Phase 9+ feature; schema reserved; UI behind flag.

---

## 12. Group Calls Indicator

- Header shows “Voice chat” pulse when active (see `13-calls.md`).
- Members can join; not the same as 1:1 call.

---

## 13. Leave / Delete Group

| Action | Who | Effect |
|--------|-----|--------|
| Leave | Member/Admin | Remove membership; history local clear optional |
| Delete group | Owner | Soft-delete conversation; all members lose access |
| Clear history | Member | Deletes messages for me only (per-user hide) or everyone if admin + delete rights |

### Confirm dialogs
Always for delete/leave when owner.

---

## 14. Service Messages

Emit system messages for: create, join, leave, kick, pin, title/photo change, ownership transfer, topic create. Render centered, non-bubble.

---

## 15. Anti-Spam / Safety

- Rate limit joins per IP/user.
- Report group flow.
- Shadow-ban tooling deferred to admin console.

---

## 16. Cross-Cutting Template Notes

For each admin action (promote, ban, invite create, etc.) implement the 17 subsections in engineering tickets using this doc’s rules. Summary requirements:

- **Accessibility:** member lists as listboxes; destructive confirms with focus trap.
- **Mobile:** full-screen editors; long-press member actions.
- **Desktop:** side info panel; right-click members.
- **Animation:** list row removals 150ms; permission toggles snappy.
- **Loading/Empty/Error:** skeletons for members; empty invite list CTA; 403 toasts.

---

## 17. Real-time Events (Groups)

| Event | Payload |
|-------|---------|
| `group:member_added` | `{ conversationId, member }` |
| `group:member_removed` | `{ conversationId, userId, reason }` |
| `group:member_updated` | `{ conversationId, userId, role, permissions }` |
| `group:updated` | `{ conversationId, title, avatarUrl, ... }` |
| `group:join_request` | `{ conversationId, user }` |
| `group:permissions_updated` | `{ conversationId, defaults, slowModeSeconds }` |

---

## 18. Testing Checklist

- [ ] Create group + service message
- [ ] Permission deny send media
- [ ] Slow mode countdown
- [ ] Invite expire/max uses
- [ ] Join request approve
- [ ] Ban blocks rejoin
- [ ] Ownership transfer
- [ ] History hidden for new member
- [ ] Public username uniqueness

---

*End of 05-groups.md*
