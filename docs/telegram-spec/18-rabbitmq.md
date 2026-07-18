# 18 — RabbitMQ & BullMQ Events

> **MVP Status:** ⛔ Neither BullMQ workers nor RabbitMQ are implemented yet. Use **BullMQ first** (same Redis). Introduce **RabbitMQ** when splitting into multiple services (Phase 10).

---

## 1. When BullMQ vs RabbitMQ

| Concern | Use |
|---------|-----|
| Delayed jobs, retries, simple workers in Nest | **BullMQ** |
| Cross-service domain events, multiple consumers, fanout topologies | **RabbitMQ** |
| Media CPU jobs colocated with API | BullMQ |
| Notification service as separate deployable | RabbitMQ (or BullMQ on shared Redis) |

---

## 2. BullMQ Queues

| Queue | Jobs | Notes |
|-------|------|-------|
| `sms` | `sms.send` | OTP |
| `email` | `email.send` | recovery, digests |
| `notifications` | `push.dispatch` | FCM/APNs/WebPush |
| `media` | `media.process`, `media.virusScan` | thumbs, transcode |
| `search` | `search.index`, `search.delete` | FTS/OpenSearch |
| `messages` | `message.scheduled.send`, `message.sweepDeleted` | delayed |
| `maintenance` | `presence.sweep`, `sessions.purge` | cron |

### Job payload examples
```json
{ "type": "push.dispatch", "userId": "...", "messageId": "...", "conversationId": "..." }
{ "type": "message.scheduled.send", "messageId": "..." }
{ "type": "media.process", "uploadId": "...", "messageId": "..." }
```

### Retry policy
- Attempts: 5
- Backoff: exponential 2s × 2^n
- DLQ: BullMQ `failed` + alert metrics; optional move to `dead` queue

---

## 3. RabbitMQ Topology (Phase 10)

### Exchanges
| Exchange | Type | Purpose |
|----------|------|---------|
| `chat.events` | topic | domain events |
| `chat.events.dlx` | topic | dead letters |

### Routing keys
| Routing key | Event |
|-------------|-------|
| `message.created` | New message persisted |
| `message.updated` | Edit/pin/react |
| `message.deleted` | Delete |
| `conversation.updated` | Meta change |
| `user.updated` | Profile |
| `notification.requested` | After mute filters |
| `media.uploaded` | Raw upload ready |
| `search.reindex` | Backfill |
| `call.ended` | Analytics |

### Queues
- `notifications.worker` bind `message.created`, `call.*`
- `media.worker` bind `media.uploaded`
- `search.worker` bind `message.*`
- `analytics.worker` bind `#` (optional)

### Message envelope
```json
{
  "id": "uuid",
  "type": "message.created",
  "occurredAt": "2026-07-13T10:00:00.000Z",
  "actorId": "...",
  "payload": {}
}
```

### Retry / DLQ
- `x-dead-letter-exchange: chat.events.dlx`
- Consumer nack without requeue after max retries
- Poison message inspection dashboard

---

## 4. Producer Rules (API)

After successful DB commit:
1. Emit realtime WS (immediate UX)
2. Enqueue BullMQ / publish RabbitMQ for async side effects
3. Never do SMTP/FCM in request thread

Outbox pattern (recommended at scale):
- Write `OutboxEvent` row in same transaction
- Publisher relay to RabbitMQ/BullMQ

---

## 5. Consumer Idempotency

- Use event `id` unique processed set in Redis `processed:{id}` TTL 7d
- Push dedupe keys already in Redis strategy

---

## 6. Observability

- Queue depth dashboards
- Failed job alerts
- Lag between `message.created` and push sent (SLO)

---

## 7. Local Dev

- BullMQ with Redis from docker-compose sufficient
- RabbitMQ container optional profile `docker compose --profile mq up`

---

*End of 18-rabbitmq.md*
