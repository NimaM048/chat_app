# 15 — REST API

> **MVP Status:** 🟡 Implemented under `/api` without `v1`. This document is the **target** OpenAPI-oriented inventory. Map current controllers during migration.

Base: `/api/v1`  
Auth: `Authorization: Bearer <accessToken>` unless noted.  
Errors: `{ "error": { "code", "message", "details?" } }`  
Pagination: `cursor` + `limit` → `{ items, nextCursor }`.

---

## 1. Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Email/password register (MVP) |
| POST | `/auth/login` | — | Email/username + password |
| POST | `/auth/refresh` | refresh | Rotate tokens |
| POST | `/auth/logout` | ✅ | Revoke session(s) |
| GET | `/auth/me` | ✅ | Current user |
| POST | `/auth/otp/request` | — | Start phone OTP |
| POST | `/auth/otp/verify` | — | Verify OTP |
| POST | `/auth/2fa/verify` | pending | Cloud password |
| POST | `/auth/qr/create` | — | Desktop QR token |
| POST | `/auth/qr/:token/scan` | ✅ | Mobile scan |
| POST | `/auth/qr/:token/approve` | ✅ | Approve |
| POST | `/auth/qr/:token/reject` | ✅ | Reject |

### Example DTOs
```ts
// POST /auth/login
{ emailOrUsername: string; password: string; deviceId: string; deviceName?: string }
// → { accessToken, refreshToken, user }

// POST /auth/otp/request
{ phone: string; channel?: 'sms'|'call'; deviceId: string; platform: string }
```

Rate limits: see `01-authentication.md` / `19-security.md`.

---

## 2. Users & Privacy

| Method | Path | Description |
|--------|------|-------------|
| PATCH | `/users/me` | Update profile |
| POST | `/users/me/avatar` | Upload avatar |
| DELETE | `/users/me/avatar` | Remove avatar |
| GET | `/users/:idOrUsername` | Public/peer profile |
| GET | `/users/:id/common-groups` | Mutual groups |
| GET/PATCH | `/users/me/preferences` | Theme, language, etc. |
| GET/PATCH | `/users/me/privacy` | Privacy map |
| GET/POST/DELETE | `/users/me/blocks` | Block list |
| POST | `/users/:id/block` | Block user |
| DELETE | `/users/:id/block` | Unblock |
| POST | `/users/:id/report` | Report |
| GET | `/users/search?q=` | People search |

---

## 3. Sessions / Devices

| Method | Path | Description |
|--------|------|-------------|
| GET | `/sessions` | Active sessions |
| DELETE | `/sessions/:id` | Revoke |
| POST | `/sessions/revoke-others` | Terminate others |
| POST | `/devices/push-token` | Register push |
| DELETE | `/devices/push-token` | Unregister |

---

## 4. Conversations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/conversations` | Chat list |
| POST | `/conversations/direct` | `{ userId }` |
| POST | `/conversations/group` | `{ title, memberIds }` |
| POST | `/conversations/saved` | Ensure Saved Messages |
| GET | `/conversations/:id` | Detail |
| PATCH | `/conversations/:id` | archive/mute/title… |
| POST | `/conversations/:id/pin` | Pin/unpin |
| DELETE | `/conversations/:id` | Leave/delete dialog |
| POST | `/conversations/read-all` | Mark all read |

---

## 5. Messages

| Method | Path | Description |
|--------|------|-------------|
| GET | `/conversations/:id/messages` | History cursor / aroundId |
| POST | `/conversations/:id/messages` | Send |
| GET | `/conversations/:id/pinned` | Pinned list |
| GET | `/conversations/:id/messages/search` | In-chat search |
| PATCH | `/messages/:id` | Edit |
| DELETE | `/messages/:id` | Delete `{ mode }` |
| POST | `/messages/batch-delete` | Batch |
| POST | `/messages/:id/pin` | Pin |
| POST | `/messages/forward` | Forward one |
| POST | `/messages/batch-forward` | Forward many |
| POST | `/messages/:id/reactions` | `{ emoji }` toggle |

### Send body
```ts
{
  type: 'TEXT'|'IMAGE'|'FILE'|'VOICE'|...,
  content?: string,
  clientMessageId: string,
  replyToId?: string,
  silent?: boolean,
  scheduledFor?: string,
  uploadId?: string,
  albumId?: string,
  spoiler?: boolean
}
```

---

## 6. Drafts / Folders / Contacts

| Method | Path | Description |
|--------|------|-------------|
| PUT | `/drafts/:conversationId` | Upsert draft |
| DELETE | `/drafts/:conversationId` | Clear |
| GET/POST | `/folders` | List/create |
| PATCH/DELETE | `/folders/:id` | Update/delete |
| POST | `/folders/:id/conversations` | add/remove |
| GET/POST | `/contacts` | Contacts |
| DELETE | `/contacts/:userId` | Remove |

---

## 7. Groups / Channels

| Method | Path | Description |
|--------|------|-------------|
| GET | `/groups/:id/members` | Members |
| PATCH | `/groups/:id/members/:userId` | Role/permissions |
| DELETE | `/groups/:id/members/:userId` | Kick |
| POST | `/groups/:id/members/:userId/ban` | Ban |
| POST | `/groups/:id/transfer-ownership` | Transfer |
| GET/POST | `/groups/:id/invite-links` | Invites |
| POST | `/invites/:code/join` | Join |
| GET | `/groups/:id/join-requests` | Pending |
| POST | `/channels` | Create channel |
| POST | `/channels/:id/discussion` | Link discussion |
| GET | `/channels/:id/stats` | Admin stats |

---

## 8. Uploads / Search / Notifications / Calls / Health

| Method | Path | Description |
|--------|------|-------------|
| POST | `/uploads/initiate` | Signed upload |
| POST | `/uploads/:id/complete` | Finalize |
| POST | `/upload` | MVP multipart |
| GET | `/search` | Global search |
| GET/DELETE | `/search/recent` | Recents |
| GET/PATCH | `/users/me/notification-settings` | Prefs |
| GET | `/calls/history` | Call history |
| POST | `/calls/rooms` | Group voice room |
| GET | `/health` | Liveness/DB |
| GET | `/meta/countries` | Country list optional |

---

## 9. Status Code Conventions

| Code | Use |
|------|-----|
| 200/201 | Success |
| 204 | Empty success |
| 400 | Validation |
| 401 | Auth |
| 403 | Permission |
| 404 | Not found (no leak) |
| 409 | Conflict (username) |
| 413 | Payload too large |
| 429 | Rate limit + `Retry-After` |
| 500 | Unexpected |

---

## 10. Migration Notes (current → target)

| Current | Target |
|---------|--------|
| `/api/auth/*` | `/api/v1/auth/*` |
| `/api/users/*` | `/api/v1/users/*` |
| `/api/conversations*` etc. on ChatController | `/api/v1/...` modular controllers |
| `/api/upload` | keep + add initiate/complete |
| `/api/health` | `/api/v1/health` (+ legacy alias) |

Serve both during transition with Nest global prefix versioning.

---

## 11. Testing / Contracts

- Maintain OpenAPI via Swagger; publish `docs/schemas/openapi.json` in CI.
- Contract tests for auth + send message + pagination cursors.

---

*End of 15-rest-api.md*
