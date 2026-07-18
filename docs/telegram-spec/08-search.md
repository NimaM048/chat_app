# 08 — Search

> **MVP Status:** 🟡 Global search API + UI sheet and in-chat client search exist. Full tabbed global search (people/chats/messages/media/links/files), FTS ranking, recent searches sync, and keyboard-complete navigation are incomplete.

---

## 1. Purpose

Search is how users recover needles in a haystack of chats and cloud history. Telegram splits **global search** (people, messages across chats) from **in-chat search**.

**Why:** Cloud history is worthless without retrieval.  
**Pros:** Fast jump; discovery of public usernames.  
**Cons:** Ranking is hard; privacy must hide non-visible content.  
**Improvements:** Typo tolerance; filters by date/chat type; saved searches.

---

## 2. Global Search

### UI Layout
1. Search field autofocus (from home).
2. Recent searches chips (clearable) when query empty.
3. Tabs when query non-empty: **Chats** | **Messages** | (Media | Links | Files) optional secondary.
4. Results lists with highlight `<mark>`.
5. Empty: “No results”.

### UX Behavior
- Debounce **200ms**; cancel in-flight (AbortController).
- Min chars: 1 for @username exact; 2+ for message FTS.
- `@query` biases username/people.
- `#hashtag` biases hashtag messages if supported.
- Enter opens first result; arrows move; Esc clears/closes.
- Click recent re-runs query.

### Ranking (target)
1. Exact username match
2. Contact name prefix
3. Chat title match (member of)
4. Public channel/group title
5. Message FTS by `ts_rank` + recency boost
6. Demote muted/archived slightly (don’t hide)

### API
```http
GET /api/v1/search?q=&tab=chats|messages|media|links|files&cursor=&limit=30
→ {
  "people": [...],
  "chats": [...],
  "messages": [{ "message": {}, "conversation": {}, "highlights": ["..."] }],
  "nextCursor": null
}

GET /api/v1/search/recent
DELETE /api/v1/search/recent
POST /api/v1/search/recent { "q": "..." }
```

### Database
```sql
-- messages.search_vector tsvector
CREATE INDEX messages_fts_idx ON messages USING GIN (search_vector);
```
Prisma: maintain `searchVector` via trigger or app-side update on write. BullMQ `search.index` for async at scale.

### Permissions
Only conversations user belongs to; public directory separate (`isPublic`).
Respect block lists (don’t show blocked users as people results unless already chatting).

### Edge Cases
- Query emoji-only.
- Very common words → require more chars or show chats only.
- RLS-equivalent filters always applied.
- Deleted messages excluded (`deletedAt IS NULL`).

---

## 3. In-Chat Search

See `04-conversation.md` §H. Counter navigation; highlight in bubble; load around match id.

```http
GET /api/v1/conversations/:id/messages/search?q=&cursor=
```

---

## 4. Media / Links / Files Tabs

Filter messages by type; show rich rows (thumb, URL domain, file size). Same FTS + type filter.

---

## 5. States

`idle_recents` | `debouncing` | `loading` | `results` | `empty` | `error`

### Loading / Empty / Error
- Loading: section skeletons.
- Empty: illustration + tips.
- Error: retry.

---

## 6. Realtime

Search results are pull-based; no WS required. Invalidate recent list on other devices via `search:recent_updated` optional.

---

## 7. Accessibility

- Combobox pattern: `role="combobox"` + `aria-controls` listbox.
- Highlights don’t rely on color alone (bold + mark).
- Announce result count politely.

### Mobile
Full-screen search; recent as horizontal chips.

### Desktop
Popover/panel; keep chat visible behind dimmer optional.

### Animation
Panel 180ms; mark highlight fade 120ms.

---

## 8. Performance

- Limit 30; cursor deep paging.
- Timeout 2s; partial results OK.
- Cache recent queries client-side.
- Avoid leading-wildcard SQL.

---

## 9. Testing

- [ ] Debounce cancel
- [ ] Username exact
- [ ] No leak across membership
- [ ] Highlight injection safe (escape HTML)
- [ ] In-chat next/prev wrap

---

*End of 08-search.md*
