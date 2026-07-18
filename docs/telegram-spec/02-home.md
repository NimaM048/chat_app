# 02 — Home (App Shell)

> **MVP Status:** ✅ Telegram-like two-pane shell exists in `telegram-shell.tsx` with sidebar + conversation, dark/light theme, responsive collapse. 🟡 Folders strip, connection banner polish, stories, calls tab, and full “New channel/secret chat” entry points are incomplete or absent.

---

## 1. Purpose

The Home shell is the persistent application chrome that hosts Chat List, Conversation, optional Info panel, and global entry points (search, compose, settings). It establishes spatial memory: users always know where chats live vs where the active thread lives.

**Why Telegram designed it this way:** Cloud messengers are multi-tasking surfaces. A stable two-pane desktop layout minimizes navigation cost; mobile uses a stack because viewport is scarce. Connection status is honest about sync — trust depends on knowing whether you’re live.

**Advantages:** Fast chat switching; clear hierarchy; works offline-aware.  
**Disadvantages:** Dense for new users; folders add complexity.  
**Improvements:** Stronger empty-state onboarding; optional three-pane for power users; command palette (`Ctrl+K`).

---

## 2. UI Layout

### Desktop / Web ≥ 900px (two-pane default)

```
┌────────────┬──────────────────────────────────────────┐
│ Folders*   │                                          │
│ Chat List  │           Conversation Pane              │
│ ~360–420px │           (flex grow)                    │
│            │                                          │
│ [Search]   │  optional Info panel → ~360px (toggle)   │
│ [Compose+] │                                          │
│ [Profile]  │                                          │
└────────────┴──────────────────────────────────────────┘
```

\*Folders may be a horizontal tab strip above the chat list or a narrow left rail of folder icons (Telegram Desktop uses top tabs + left menu).

### Web / Tablet 600–899px
- Two-pane if width allows; otherwise single-pane with route stack.

### Mobile < 600px (Android / iOS / narrow Web)
- Single pane: Chat List OR Conversation OR Settings (stack).
- Bottom nav optional (Chats / Calls / Contacts / Settings) — Telegram Android uses drawer + tabs variants; we standardize:
  - **Primary:** stack navigation with hamburger/drawer for Settings/Contacts.
  - **Optional:** bottom tabs if Calls ship.

### Chrome Elements (left column, top→bottom)
1. **Header row:** hamburger OR profile avatar; app title or folder name; compose (`✏️` / pencil) button; menu.
2. **Search field** (or icon expanding to search mode) — see `08-search.md`.
3. **Folders tab strip** (if >1 folder) — see `03-chat-list.md`.
4. **Archive entry** (collapsed bar when archived chats exist).
5. **Chat list viewport** (virtualized).
6. **Connection banner** (overlays top of list when not `connected`).

### Global overlays
- New chat menu (private / group / channel / secret*).
- Settings routes.
- Media viewer (portal, app-wide).
- Call overlay (future).
- Toasts.

\*Secret chats: document as optional E2E product; **deferred** unless explicitly scheduled — do not block MVP.

---

## 3. UX Behavior

### Pane focus model
- Clicking a chat list row selects conversation; desktop keeps list visible; mobile pushes conversation route.
- `Esc` on desktop: closes info panel → clears selection mode → blurs search → focuses list.
- Browser back on mobile: pops stack.

### Profile shortcut
- Tap own avatar → opens self-profile / settings hub (Telegram: side menu). Our target: left drawer on mobile; menu under avatar on desktop.

### Theme
- System / Light / Dark persisted (`localStorage` + server preference when accounts sync).
- Theme switch should not remount chat state.

### Connection status banner
| WS/Network state | Banner copy | Style |
|------------------|-------------|-------|
| `connecting` | Connecting… | subtle amber/gray |
| `updating` | Updating… | subtle |
| `disconnected` / offline | Waiting for network… | stronger |
| `connected` | (hidden, fade out 200ms) | — |

Banner does not block list interaction.

### Compose (+) menu items
1. New message (user picker)
2. New group
3. New channel
4. New secret chat (if enabled)
5. (Desktop) Invite / Share link

### Notification permission
- After first successful inbound message or second session day, soft prompt: “Enable notifications”.
- Never block UI; dismiss remembers for 7 days.

### Stories strip
- Telegram shows stories at top of chat list.
- **Our decision:** ⛔ Deferred — do not implement in Phases 1–7. Spec leaves a placeholder slot so layout doesn’t thrash later (`height: 0` until feature flag).

---

## 4. User Flows

### Cold start → Home
1. Auth bootstrap succeeds.
2. Shell mounts; chat list query starts.
3. Restore last opened `conversationId` from local state (desktop); mobile lands on list.
4. WS connect; presence hydrate.

### Open settings
1. Avatar/hamburger → Settings.
2. Mobile pushes full-screen; desktop may replace conversation pane or open modal/route column.

### Start new group
1. Compose → New group.
2. Member picker → title/avatar → create → open conversation.

---

## 5. States

| State | Behavior |
|-------|----------|
| `bootstrapping` | Shell chrome + skeletons in list |
| `ready` | Interactive |
| `degraded_offline` | Banner; cached list; send queues |
| `empty_account` | List empty state with CTAs |
| `error_fatal` | Retry full-screen |

---

## 6. Edge Cases

- Token expires while sitting on Home → refresh; if fail, soft logout to Welcome preserving return URL.
- Resize across 900px breakpoint: preserve selected chat; convert layout without remounting message virtualizer if possible.
- Multiple tabs: leader election optional; all tabs receive WS; avoid duplicate notifications (see `10-notifications.md`).
- Very small height (landscape phone): collapse search into icon.

---

## 7. Backend Requirements

- Shell itself is client-only.
- Depends on: `GET /conversations`, WS connection auth, `GET /me`, settings preferences endpoint.

---

## 8. API Requirements

```http
GET /api/v1/me
GET /api/v1/conversations?folderId=&cursor=&limit=
GET /api/v1/users/me/preferences
PATCH /api/v1/users/me/preferences
{ "theme": "system"|"light"|"dark", "language": "en", "lastOpenConversationId": "..." }
```

---

## 9. Database Requirements

```prisma
model UserPreference {
  userId                  String  @id
  theme                   String  @default("system")
  language                String  @default("en")
  lastOpenConversationId  String?
  sendOnEnter             Boolean @default(true)
  // ...
}
```

---

## 10. Real-time Events

| Event | Effect on shell |
|-------|-----------------|
| `presence:update` | Update peer status if visible in header |
| `conversation:updated` | Reorder list, badges |
| `message:new` | Preview + unread if not active |
| `connection` lifecycle | Banner |

---

## 11. Permissions

Authenticated users only. Guest shell not supported.

---

## 12. Validation

Preferences enums validated server-side.

---

## 13. Accessibility

- Landmarks: `navigation` (list), `main` (conversation).
- Skip link: “Skip to message input”.
- Drawer: focus trap + `Esc` closes.
- Announce connection banner via `aria-live="polite"`.

---

## 14. Mobile Differences

- Stack navigator; transition slide 280ms.
- Hamburger drawer width ~85% max 320px.
- System back integrates with stack.
- Status bar color matches theme.

---

## 15. Desktop Differences

- Persistent list; optional Info panel (`Ctrl+I` / header button).
- Window title: `Chat title — App` or just App when idle.
- Tray icon badge (desktop wrapper).

---

## 16. Animation Details

| Motion | Spec |
|--------|------|
| Mobile push/pop | 280ms shared axis |
| Drawer open | 240ms |
| Banner show/hide | 200ms fade |
| Theme cross-fade | 150ms on CSS vars |
| Folder tab indicator | 200ms slide underline |

---

## 17. Loading / Empty / Error

- **Loading:** list skeletons (avatar circle + 2 bars × N).
- **Empty:** illustration + “Start a conversation” + button.
- **Error:** inline retry on list; fatal only if `/me` fails.

---

## Layout Measurements (defaults)

| Token | Value |
|-------|-------|
| `--chat-list-width` | 420px (min 300, max 480, resizable optional) |
| `--info-panel-width` | 360px |
| `--shell-header-height` | 56px |
| `--folders-height` | 48px |
| Breakpoint `md` | 900px |
| Breakpoint `sm` | 600px |

---

## Keyboard (Shell)

| Shortcut | Action |
|----------|--------|
| `Ctrl+F` / `Ctrl+K` | Focus global search / command palette |
| `Ctrl+N` | New message |
| `Ctrl+,` | Settings |
| `Esc` | Close overlays / collapse search |
| `Alt+↑/↓` | Previous/next chat |
| `Ctrl+1..9` | Folder select (if any) |

---

## UX Analysis Summary

Telegram optimizes for **expert throughput** (keyboard, density, multi-pane) while remaining approachable on mobile via stack. Our shell should keep density high on desktop without copying dated visual chrome; use the design tokens in `21-design-system.md`.

---

*End of 02-home.md*
