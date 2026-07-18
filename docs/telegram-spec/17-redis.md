# 17 — Redis Strategy

> **MVP Status:** 🟡 Redis used for presence + rate limiting (with in-memory fallback). Expand to OTP, typing, denylist, Socket.IO adapter, BullMQ, unread cache.

---

## 1. Conventions

- Key format: `{domain}:{entity}:{id}` lowercase
- Always set TTL on ephemeral keys
- Values: JSON strings or Redis hashes/sets
- Prefix env `REDIS_KEY_PREFIX=chat:` in shared Redis

---

## 2. Key Catalog

| Key | Type | TTL | Purpose |
|-----|------|-----|---------|
| `presence:{userId}` | hash/string | 45s | Online status + lastSeenAt |
| `presence:subscribers:{userId}` | set | 24h | Who should get presence updates (optional) |
| `typing:{convId}:{userId}` | string | 5s | Typing kind |
| `otp:{phoneHash}` | hash | 300s | codeHash, attempts, createdAt |
| `otp:attempts:{phoneHash}` | string | 15m | verify failures |
| `rl:otp:phone:{phoneHash}` | string | window | rate limit counter |
| `rl:otp:ip:{ip}` | string | window | rate limit |
| `rl:login:ip:{ip}` | string | window | |
| `rl:login:user:{userId}` | string | window | |
| `rl:api:{userId}:{route}` | string | window | general API RL |
| `session:deny:{jti}` | string | accessTTL | JWT denylist |
| `qr:{token}` | hash | 60s | QR login state |
| `slow:{convId}:{userId}` | string | cooldown | slow mode |
| `focus:{userId}:{sessionId}` | string | 60s | active conversation for notif suppress |
| `notif:dedupe:{messageId}:{userId}` | string | 10m | prevent double push |
| `unread:{userId}:{convId}` | string | 24h | cached unread (optional) |
| `msg:views:{messageId}` | HyperLogLog/PF | 30d | channel views approx |
| `lock:job:{name}:{id}` | string | short | job locks if needed |

Socket.IO adapter / BullMQ use their own key namespaces (`socket.io#`, `bull:`).

---

## 3. Pub/Sub Channels

Prefer Socket.IO Redis adapter over manual pub/sub for WS fanout.

Optional app channels:
- `pubsub:presence`
- `pubsub:chatlist:{userId}`

---

## 4. Presence Algorithm

1. On connect / ping: `SET presence:{id} JSON EX 45`
2. If transition offline→online: broadcast
3. Sweeper every 10s: scan expired via heartbeat timestamps OR rely on TTL + lazy read

Privacy applied at publish time.

---

## 5. Rate Limiting Algorithm

Fixed window or token bucket via Lua:
- `INCR` + `EXPIRE` on first incr
- If count > limit → 429 with TTL as retryAfter

---

## 6. Memory & Eviction

- Policy: `volatile-ttl` or `allkeys-lru` in cache-only Redis
- Estimate: presence 1M users × ~100B ≈ 100MB; OTP negligible; BullMQ grows with queue depth — monitor
- Separate Redis DB index or instances: `cache` vs `queue` at scale

---

## 7. Failure Mode

If Redis down:
- Presence → all “last seen recently”
- Rate limit → fail open with warning metrics OR fail closed on auth endpoints (prefer **fail closed for OTP/login**, fail open for typing)
- Current code in-memory fallback — document for single-node only

---

## 8. Security

- Hash phones in OTP keys (HMAC with server secret)
- No plaintext passwords/tokens in Redis except ephemeral OTP hashes
- Network ACL / AUTH redis password / TLS in prod

---

*End of 17-redis.md*
