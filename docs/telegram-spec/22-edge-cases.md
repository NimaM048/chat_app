# 22 — Edge Cases (Cross-Cutting)

Each item: **Scenario → Expected → Recovery → Test idea**.

---

### Offline send
User sends while offline → message queued locally as `pending` → on reconnect flush in order → Test: airplane mode send then online.

### Reconnect gap
WS drops 30s → on reconnect fetch `after=lastId` → no duplicates → Test: kill server briefly.

### Deleted message while viewing
Another user deletes for everyone → bubble collapses to “deleted” or removes → Test: two clients.

### Deleted user
Peer account deleted → “Deleted Account” title; can’t message → Test: anonymize user fixture.

### Blocked users
Block → cannot send; existing history visible; presence hidden → Test: API 403.

### Large files
Over limit → client rejects before upload → Test: 16MB vs 15MB MVP.

### Slow network
Upload progress stalls → timeout + retry → Test: network throttling.

### Duplicate requests
Double-click send → `clientMessageId` idempotent → Test: parallel POST same id.

### Expired access token
API 401 → refresh → retry once → fail → logout → Test: expired JWT fixture.

### Refresh reuse
Stolen refresh reused → revoke all sessions → Test: replay refresh.

### Race edit/delete
Edit then delete → delete wins; clients converge via WS → Test: concurrent requests.

### Multi-device unread
Read on phone → desktop unread clears → Test: two sessions seen event.

### Presence sync
Online on desktop → mobile shows online within TTL → Test: heartbeat.

### Conflict draft
Two devices type drafts → last `updatedAt` wins; warn optional → Test: concurrent PUT drafts.

### Clock skew
Client clock wrong → server times authoritative for edit windows → Test: skew simulator.

### RTL / mixed script
Arabic reply to English → `dir=auto` per bubble → Test: visual + a11y.

### Very long message
4096+ → reject; near-limit Show more UI → Test: boundary lengths.

### Empty / whitespace message
Cannot send → Test: spaces only.

### Unicode abuse / Zalgo
Sanitize rendering height; reject over combining marks → Test: zalgo string.

### Rate limit UX
429 → toast with countdown → Test: hammer endpoint.

### Account banned
Login denied `AUTH_BANNED` → support message → Test: flag user.

### Removed from group while open
Banner read-only; composer replaced → Test: kick event.

### Reply to deleted
Quote shows “Original message deleted” → Test: delete then view reply.

### Forward chain
Preserve original attribution; depth unlimited but display original → Test: forward thrice.

### Simultaneous pin
Two admins pin → both pinned ordered by time → Test: concurrent pin.

### Upload fail mid-way
Bubble failed; retry resumes/reuploads → Test: abort server.

### WS split-brain (multi-tab)
Both tabs receive events; single notification via tag/dedupe → Test: two tabs.

### Redis down
Auth RL fail closed; typing degraded; app still sends via REST → Test: stop redis.

### DB blip
API 503 health fail; client backoff → Test: pause postgres.

### Push + in-app double
Foreground suppresses push via focus key → Test: focused chat inbound.

### Partial outage media
Thumb fails; placeholder; message text ok → Test: break CDN.

### Invite expired
Join error page with CTA → Test: expired link.

### Slow mode ignore
Client bypass attempt → server 429 SLOW_MODE → Test: raw API.

### Channel subscriber posts
403 → Test: subscriber token.

### Privacy last seen
Viewer with NOBODY sees “last seen a long time ago” bucket → Test: matrix.

### Session revoked mid-typing
Force logout; preserve draft locally → Test: revoke session.

### Emoji ZWJ / skin tones
Count as single grapheme in limits → Test: family emoji length.

### Search XSS
Highlights escaped → Test: `<script>` query/message.

### Call glare
Both call each other → one wins → Test: simultaneous invite.

### Nested modal + viewer
Media viewer above dialog z-index; Esc closes topmost → Test: keyboard.

---

*End of 22-edge-cases.md*
