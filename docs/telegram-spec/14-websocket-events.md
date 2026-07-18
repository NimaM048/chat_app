# 14 — WebSocket Events

> **MVP Status:** 🟡 Socket.IO namespace `/chat` implemented with join, send, typing, delivered, seen, and server broadcasts. Target namespace **`/ws`**. This catalog is the contract to implement/migrate toward.

---

## 1. Connection Lifecycle

### Handshake
```ts
io(SOCKET_URL, {
  path: '/socket.io',
  transports: ['websocket'],
  auth: { token: accessToken },
});
```
- Server validates JWT; joins room `user:{userId}`.
- Reject → `connect_error` with `AUTH_REQUIRED`.
- On refresh, client reconnects with new token.

### Rooms
| Room | Purpose |
|------|---------|
| `user:{userId}` | Cross-device sync, presence, session revoke |
| `conv:{conversationId}` | Message fanout for members currently joined |
| `qr:{loginToken}` | QR login (ephemeral) |
| `call:{callId}` | Call signaling |

### Client should
1. Connect after auth.
2. `conversation:join` for visible chat (and optionally prefetch).
3. Heartbeat via Socket.IO ping; app-level `presence:ping` every 30s.

### Reconnect / Resume
1. On disconnect, UI banner “Connecting…”.
2. On reconnect: re-auth, re-join conv rooms, `GET messages?after=lastId` gap fill, resend queued optimistic messages, re-send pending seen.

### Ordering
- Per-conversation causal order by server `createdAt` + monotonic `seq` (recommended add `Conversation.seq` / message `serverSeq`).
- Clients sort by `serverSeq` then id.

### Idempotency
- `clientMessageId` on sends.
- Event ids optional `eventId` for exactly-once client apply.

### Rate limits (WS)
| Event | Limit |
|-------|-------|
| `typing:*` | 1/s/conv |
| `message:send` | 20/min burst soft |
| `call:invite` | 10/min |
| `presence:ping` | 4/min |

---

## 2. TypeScript DTOs (shared)

```ts
export type PresenceStatus = 'online' | 'offline';

export interface MessageDto {
  id: string;
  clientMessageId?: string;
  conversationId: string;
  senderId: string;
  type: string;
  content: string;
  status: 'SENT' | 'DELIVERED' | 'SEEN';
  replyToId?: string | null;
  forwardedFromId?: string | null;
  isPinned: boolean;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  durationMs?: number | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  reactions?: { emoji: string; count: number; me: boolean }[];
}

export interface WsError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
```

---

## 3. Client → Server Events

| Event | Payload | Ack |
|-------|---------|-----|
| `conversation:join` | `{ conversationId }` | `{ ok: true }` |
| `conversation:leave` | `{ conversationId }` | `{ ok: true }` |
| `message:send` | `{ conversationId, content, type, clientMessageId, replyToId?, ... }` | `{ message }` or error — **prefer REST** |
| `typing:start` | `{ conversationId, kind?: 'text'|'voice'|'upload' }` | — |
| `typing:stop` | `{ conversationId }` | — |
| `message:delivered` | `{ messageIds: string[] }` | — |
| `conversation:seen` | `{ conversationId, lastReadMessageId?: string }` | `{ lastReadAt }` |
| `presence:ping` | `{}` | — |
| `focus:set` | `{ conversationId: string \| null }` | — notification suppression |
| `call:invite` / `accept` / `reject` / `end` / `signal` | see calls doc | — |

---

## 4. Server → Client Events

| Event | Payload | Rooms |
|-------|---------|-------|
| `message:new` | `MessageDto` | `conv:*`, also `user:*` for list update |
| `message:updated` | `Partial<MessageDto> & { id }` | `conv:*` |
| `message:deleted` | `{ id, conversationId, mode: 'me'\|'everyone' }` | `conv:*` |
| `message:status` | `{ id, conversationId, status }` | `user:*` of sender devices |
| `reaction:updated` | `{ messageId, conversationId, reactions }` | `conv:*` |
| `typing:update` | `{ conversationId, userId, kind, isTyping }` | `conv:*` except sender |
| `presence:update` | `{ userId, status, lastSeenAt }` | interested users / contacts strategy |
| `conversation:updated` | conversation list DTO patch | `user:*` members |
| `conversation:seen` | `{ conversationId, userId, lastReadAt }` | `conv:*` + members’ `user:*` |
| `draft:updated` | `{ conversationId, content, updatedAt }` | `user:*` (other sessions) |
| `session:revoked` | `{ sessionId }` | `user:*` |
| `session:created` | `{ deviceName, ip }` | `user:*` security toast |
| `group:*` / `channel:*` | see groups/channels | members |
| `qr:scanned` / `approved` / `rejected` / `expired` | auth | `qr:*` |
| `call:*` | signaling | `call:*` / `user:*` |
| `error` | `WsError` | socket |

---

## 5. Typing TTL

- Redis key `typing:{convId}:{userId}` TTL **5s**.
- Refresh on `typing:start`; delete on stop/send.
- Broadcast at most every 1s per user.

---

## 6. Presence Heartbeat

- Redis `presence:{userId}` = `{ status, lastSeenAt }` TTL **45s**.
- Ping every 30s refreshes TTL.
- On expire → offline + `presence:update` (via keyspace notifications or sweep job).
- Privacy: transform lastSeen for viewers per `PrivacySetting`.

---

## 7. Migration from Current `/chat`

| Current | Target |
|---------|--------|
| namespace `/chat` | `/ws` (or keep `/chat` alias during transition) |
| rooms `user:` / `conversation:` | `user:` / `conv:` |
| events largely same names | keep names; add missing |

Dual-namespace period: emit to both if needed.

---

## 8. Scaling

- `@socket.io/redis-adapter` for multi-instance.
- Sticky sessions optional if adapter present.
- Avoid large payloads; send ids + clients fetch if >16KB.

---

## 9. Security

- Auth every connect; revalidate on refresh.
- Membership check on `conversation:join`.
- Strip privileged fields from broadcasts.
- No raw error stacks to clients.

---

## 10. Testing

- [ ] Reconnect gap fill
- [ ] Typing expires
- [ ] Seen multi-device
- [ ] Join unauthorized rejected
- [ ] Session revoke forces logout

---

*End of 14-websocket-events.md*
