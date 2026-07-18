# 03 — Chat List

> **MVP Status:** 🟡 Conversations list with unread, archive API, Saved Messages, and realtime previews exist. Pinned section, server mute, folders, mark unread, swipe actions, and multi-select are incomplete or client-only.

---

## 1. Purpose

The chat list is the user’s **index of conversations** — the fastest path to resume any dialog. It answers: who said what last, what’s unread, what’s muted/pinned/archived, and which folder context I’m in.

**Why Telegram designed it this way:** One dense scannable column beats card grids for messaging. Preview + time + badges encode state without opening threads. Pins and folders scale to hundreds of chats.

**Advantages:** High information density; realtime feel; powerful organization.  
**Disadvantages:** Overwhelming at scale without folders; swipe discoverability on mobile.  
**Improvements:** Better mute visuals; optional compact density; smart “Unread” default folder.

---

## 2. UI Layout — Row Anatomy

Each row (~72px default, ~64px compact):

```
[ Avatar 48 ]  Title -------------------- Time
               Preview / Draft / Typing --- [Badges]
```

**Left:** Avatar (user/group/channel/Saved icon). Online dot (DIRECT only, privacy-gated).  
**Title row:** Display name / group title; verified/bot/scam badges; mute glyph.  
**Time:** local short time if today; else day/date.  
**Preview:** last message summary; sender prefix in groups (`Alice: hello`); media icons (📷 Photo); deleted → “Message deleted”.  
**Draft:** italic `Draft:` + draft text overrides preview when present and chat not typing.  
**Typing:** replaces preview with “typing…” / “recording voice…” (colored accent).  
**Badges (trailing):** unread count pill; `@` mention count; pinned icon (or section); checkmarks not shown in list (Telegram doesn’t show delivery in list).

### Special rows
- **Saved Messages:** bookmark avatar; title fixed; never muted by accident defaults.
- **Archive:** top collapsed bar with stacked avatars + unread sum; tap opens archive list.
- **Service chats** (if any): annotated.

---

## 3. UX Behavior

### Sorting
1. Pinned chats (user pin order) — stable.
2. Non-pinned by `lastMessageAt` DESC (or draft update time if we choose Telegram parity: drafts don’t always reorder — **Telegram:** sending/receiving reorders; draft usually keeps position unless configured — we’ll reorder on draft sync only if `draft.updatedAt` policy enabled; default **do not reorder on draft**).
3. Archived excluded from main list.

### Selection
- Click/tap opens chat.
- Right-click / long-press → context menu.
- Desktop: `Ctrl/Cmd+click` multi-select; Shift range select.
- Mobile: long-press enters selection mode.

### Unread
- Pill shows count; capped `99+` or `999+`.
- Mentions: separate `@n` badge or combined per design system.
- Mark as read: opening chat + seen protocol; or context “Mark as read”.
- Mark as unread: sets local/server flag even if caught up.

### Mute
- Icon in title row; notifications suppressed until `mutedUntil`.
- Still shows unread badges (Telegram shows them).

### Realtime
- On `message:new` for non-active chat: bump preview, increment unread (if not muted? still increment), reorder.
- Active chat: preview updates; unread stays 0 if seen events fire.

---

## 4. User Flows

### Pin chat
1. Context menu → Pin.
2. Optimistic move to pin section.
3. `POST /conversations/:id/pin` with order.

### Archive
1. Swipe left (mobile) or menu → Archive.
2. Row animates out; archive bar updates.
3. `PATCH /conversations/:id` `{ "isArchived": true }`.

### Create folder and add chats
1. Settings → Folders → Create OR menu → Add to folder.
2. Rule builder (include types / specific chats / exclude).
3. Tabs appear in list header.

---

## 5. States

| State | UI |
|-------|-----|
| loading | Skeleton rows |
| empty | CTA empty state |
| ready | Virtual list |
| selecting | Checkbox column + toolbar |
| folder_empty | “No chats in this folder” |
| offline_cached | Dimmed sync; cached data |

---

## 6. Edge Cases

- Peer deletes account: title “Deleted Account”; avatar placeholder; preview may clear.
- You leave group: row disappears (or shows read-only history policy).
- Last message deleted for everyone: show previous message preview (client may refetch snippet).
- Flood of messages: debounce reorder animation (group within 100ms).
- Pin limit: Telegram ~5 in main (varies with Premium); **our default pin limit 10** — error `PIN_LIMIT`.
- Duplicate conversation open races: single row per `conversationId`.
- Muted forever vs timed: show clock on mute icon if timed.

---

## 7. Backend Requirements

- List query must be **member-scoped**, efficient with covering indexes.
- Return DTO with: conversation meta, peer/title/avatar, lastMessage snippet, unreadCount, mentionCount, mutedUntil, isPinned, pinOrder, isArchived, draft (optional), typing (from Redis not DB).
- Unread computation: messages after `member.lastReadAt` where sender ≠ self (channels: posts after lastRead).
- Snippet generation server-side for consistency across devices.

---

## 8. API Requirements

```http
GET /api/v1/conversations?folderId=&cursor=&limit=40
→ {
  "items": [{
    "id": "...",
    "type": "DIRECT"|"GROUP"|"CHANNEL"|"SAVED",
    "title": "Alice",
    "avatarUrl": "...",
    "isPinned": false,
    "pinOrder": null,
    "isArchived": false,
    "mutedUntil": null,
    "unreadCount": 3,
    "mentionCount": 1,
    "markedUnread": false,
    "lastMessage": {
      "id": "...",
      "type": "TEXT",
      "content": "Hello",
      "senderId": "...",
      "senderName": "Alice",
      "createdAt": "...",
      "isOutgoing": false
    },
    "draft": { "content": "Hey...", "updatedAt": "..." } | null,
    "peer": { "id": "...", "isOnline": true, "lastSeenAt": null }
  }],
  "nextCursor": "..."
}

PATCH /api/v1/conversations/:id
{ "isArchived"?: boolean, "mutedUntil"?: string|null, "markedUnread"?: boolean }

POST /api/v1/conversations/:id/pin
{ "pinned": true, "order"?: number }

POST /api/v1/conversations/read-all
DELETE /api/v1/conversations/:id   // leave/delete dialog
```

Folders:
```http
GET/POST /api/v1/folders
PATCH/DELETE /api/v1/folders/:id
POST /api/v1/folders/:id/conversations { "add": [], "remove": [] }
```

---

## 9. Database Requirements

```prisma
model ConversationMember {
  // existing fields...
  mutedUntil    DateTime? @map("muted_until")
  isPinned      Boolean   @default(false) @map("is_pinned")
  pinOrder      Int?      @map("pin_order")
  markedUnread  Boolean   @default(false) @map("marked_unread")
  isArchived    Boolean   @default(false) @map("is_archived")
  lastReadAt    DateTime? @map("last_read_at")
}

model ChatFolder {
  id        String @id @default(uuid())
  userId    String
  name      String
  emoji     String?
  order     Int
  includeTypes String[] // optional rule JSON better as Json
  rules     Json
  createdAt DateTime @default(now())
}

model Draft {
  userId         String
  conversationId String
  content        String
  replyToId      String?
  updatedAt      DateTime @updatedAt
  @@id([userId, conversationId])
}
```

Indexes:
- `(user_id, is_archived, is_pinned, pin_order)`
- `(user_id, is_archived, last_message_at)` via join/conversation

---

## 10. Real-time Events

| Event | Client handling |
|-------|-----------------|
| `message:new` | Update snippet, unread, reorder |
| `message:updated` / `message:deleted` | Refresh snippet if last |
| `conversation:updated` | Archive/pin/mute/title |
| `conversation:seen` | Clear unread for actor’s other devices |
| `typing:update` | Preview typing |
| `draft:updated` | Sync draft preview cross-device |
| `folder:updated` | Refresh tabs |

---

## 11. Permissions

- Users only see conversations they membership in.
- Mute/pin/archive are **per-member** settings (not global).
- Delete chat: DIRECT hides for self; GROUP leaves; CHANNEL unsubscribes.

---

## 12. Validation

- `mutedUntil` ISO date or null; reject past dates (< now − 1 min → treat as unmute).
- Pin order unique per user among pinned.
- Folder name 1–32 chars; max folders **10** default.

---

## 13. Accessibility

- Each row: `role="option"` inside `role="listbox"` OR `role="link"` with label composed: “Alice, Hello, 3 unread, 2:41 PM”.
- Context menu keyboard accessible.
- Unread announced when focus lands.
- Swipe actions have button alternatives in menu.

---

## 14. Mobile Differences

**Swipe (Telegram-like):**
- Swipe right → Pin / Unpin (or Archive depending on version — **our standard:** swipe right Archive, swipe left reveal Mute + Delete — document final in UI kit; implement consistently).
- **Recommended standard for us:**
  - Swipe left: Mute, Delete
  - Swipe right: Archive / Unarchive
  - Long-press: full menu + selection

Haptic on action commit.

---

## 15. Desktop Differences

- Hover row shows quick actions (pin, mute) optional — Telegram often relies on menu; we may show on hover for discoverability (subtle opacity).
- Right-click menu.
- Arrow keys move highlight; Enter opens.
- Drag chats into folder tabs (Phase 4).

---

## 16. Animation Details

| Action | Animation |
|--------|-----------|
| Reorder on new message | 200ms layout shift |
| Archive out | 180ms slide + fade |
| Pin move to top | 220ms |
| Unread badge pop | 120ms scale |
| Selection mode enter | 150ms checkbox reveal |

---

## 17. Loading / Empty / Error

- **Loading:** 8–12 skeleton rows.
- **Empty (All):** “No chats yet” + New message CTA.
- **Empty (Unread folder):** “No unread chats”.
- **Error:** inline “Couldn’t load chats” + Retry; keep stale data if any.

---

## Context Menu — Complete Actions

| Action | Visibility rules |
|--------|----------------|
| Pin / Unpin | Always (if under limit) |
| Mute / Unmute | Always; submenu durations: 1h, 4h, 8h, 1d, 7d, forever |
| Archive / Unarchive | Always |
| Mark as read | If unread>0 or markedUnread |
| Mark as unread | If unread==0 |
| Add to folder | If folders exist / create |
| Clear history | Confirm; destructive |
| Delete chat / Leave group / Unsubscribe | Destructive confirm |
| Open in new window | Desktop only (future) |

---

## Folders — Product Rules

**Default smart folders (system):**
- All
- Unread
- Personal (DIRECT)
- Groups
- Channels
- Bots (if bot users exist)
- Muted (optional)

**Custom folders:** include/exclude specific chats + types; synced server-side.

**Tab UI:** horizontal scroll; selected underline; unread dot on tab if any contained chat unread.

---

## Preview Formatting Rules

| Last message type | Preview |
|-------------------|---------|
| TEXT | truncated text (emoji preserved) |
| IMAGE | 📷 Photo / caption |
| VIDEO | 📹 Video |
| VOICE | 🎤 Voice message |
| FILE | 📎 filename |
| STICKER | 🖼 Sticker |
| POLL | 📊 Poll |
| CALL | 📞 Incoming/Outgoing call |
| Deleted | Message deleted |

Outgoing prefix optional checkmark before preview on some Telegram clients — **optional** for us.

---

## Performance

- Virtualize rows (`@tanstack/react-virtual` or equivalent).
- Initial page 40; prefetch next cursor when 10 rows from end.
- Snippet max 120 chars.
- Avatar lazy-load + blurhash/placeholder.
- Avoid re-sorting entire array on each keystroke typing event — patch in place.

---

## Testing Checklist

- [ ] Pin order stable across reload
- [ ] Archive removes from main; appears in archive
- [ ] Mute suppresses notifications but keeps badge
- [ ] Draft italic preview; cleared on send
- [ ] Typing overrides draft preview temporarily
- [ ] Folder filters correct
- [ ] Multi-device unread sync
- [ ] Keyboard navigation
- [ ] Empty/error/offline

---

*End of 03-chat-list.md*
