# 26 — Roadmap

Path from **current MVP** → production-grade Telegram-inspired messenger. Estimates are T-shirt sizes for a small team (1–2 BE, 1–2 FE).

---

## Phase 0 — Current State (Done)

Auth email/password, shell, DM/group/saved, realtime typing/seen, message actions, media/voice basics, Docker, tests smoke.

**Exit:** App demoable end-to-end.

---

## Phase 1 — Spec Alignment & Auth Hardening (M)

- Version APIs `/api/v1`; WS alias `/ws`
- Session model + devices UI
- Server mute + drafts sync
- Pin order + mark unread
- Connection banner polish
- Docs-driven MVP status updates

**Exit:** Multi-device sessions revoke works; mute/drafts cross-device.

---

## Phase 2 — Groups Permissions (L)

- Roles owner/admin/member
- Permission matrix enforcement
- Invite links + join requests
- Slow mode + history visibility
- Member ban/restrict

**Refs:** `05-groups.md`  
**Exit:** Admin can moderate a 50-member group.

---

## Phase 3 — Channels (L)

- CHANNEL type, posts, views
- Public username
- Discussion group link
- Scheduled posts

**Refs:** `06-channels.md`  
**Exit:** Publish-only channel with subscribers.

---

## Phase 4 — Organization UX (M)

- Chat folders server sync
- Archive UX complete
- Settings privacy basics (last seen, who can message)
- Block/report

**Refs:** `03`, `07`, `09`  
**Exit:** Folders + privacy enforced.

---

## Phase 5 — Media Platform (L)

- S3 signed uploads; raise size limits
- Media viewer albums/zoom
- Thumbnails/transcode BullMQ
- Compression chooser
- Shared media tabs

**Refs:** `11`, `12`, `18`  
**Exit:** 100MB+ upload reliable; viewer polished.

---

## Phase 6 — Notifications (M)

- Web Push + FCM/APNs
- Mute-aware fanout
- Badge sync
- Login alerts

**Refs:** `10`  
**Exit:** Background message wakes device.

---

## Phase 7 — Search Upgrade (M)

- `tsvector` + ranking
- Tabbed global search
- Recent searches

**Refs:** `08`  
**Exit:** Find message across chats <1s typical.

---

## Phase 8 — Calls (XL)

- LiveKit/SFU integration
- 1:1 voice/video
- Group voice chats
- TURN

**Refs:** `13`  
**Exit:** Stable 1:1 call NAT-traversal.

---

## Phase 9 — Expression & Power Features (L)

- Stickers/GIF panel
- Polls
- Scheduled + silent send
- Message selection polish
- Topics (optional)
- Phone OTP + QR login (if SMS budget)

**Refs:** `01`, `04`  
**Exit:** Parity on daily-driver features.

---

## Phase 10 — Hardening & Scale (L)

- RabbitMQ outbox
- Read replicas / message partition plan
- Security audit
- Load tests meet SLOs
- Observability (OpenTelemetry)
- Optional proxy support

**Refs:** `18`, `19`, `23`  
**Exit:** Production readiness review passed.

---

## Feature Checklist (summary)

| Feature | Status |
|---------|--------|
| Email auth | ✅ |
| Phone OTP / QR / 2FA | ⛔ |
| Chat shell | ✅ |
| DM / Group basic / Saved | ✅ |
| Typing / Presence / Seen | ✅ |
| Reply Forward Pin Edit Delete React | ✅ |
| Folders | ⛔ |
| Archive | 🟡 |
| Mute / Drafts server | 🟡 client |
| Channels | ⛔ |
| Group roles | ⛔ |
| Push notifications | ⛔ |
| Media viewer advanced | 🟡 |
| Calls | ⛔ |
| Polls / Stickers | ⛔ |
| Privacy settings | ⛔ |
| Search FTS | 🟡 |

Full matrix: `docs/inventories/feature-checklist.md`.

---

## Risk Register

- SMS cost/deliverability for OTP
- WebRTC complexity
- Message table growth
- Notification spam UX

---

## Suggested Near-Term Sprint Order

1. Server mute + drafts + sessions  
2. Group permissions + invites  
3. Push notifications  
4. S3 + media viewer  
5. Channels  

---

*End of 26-roadmap.md*
