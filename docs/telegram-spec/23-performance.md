# 23 — Performance

---

## 1. SLOs (targets)

| Metric | Target |
|--------|--------|
| Message send API p99 | < 150ms (excl upload) |
| WS fanout local | < 50ms |
| Chat list TTI cached | < 500ms |
| History page fetch p99 | < 200ms |
| Reconnect gap fill | < 1s for 100 msgs |
| Lighthouse perf (web shell) | ≥ 80 |

---

## 2. Frontend

- **Virtualize** chat list + message list.
- **TanStack Query**: staleTime chat list 10–30s; messages infinite query.
- **Optimistic UI** for send/react/mute/pin.
- **Debounce** search 200ms; typing emit 300ms; draft sync 500–1000ms.
- **Throttle** presence/scroll handlers 100–200ms.
- **Code split** settings, media viewer, emoji panel.
- **Image**: srcset, BlurHash, lazy.
- **Avoid** blind `useMemo`/`useCallback` — follow React Compiler guidance; memoize hot list row components only.
- **Prefetch** conversation on row hover (desktop) after 150ms.

---

## 3. Network

- HTTP/2; gzip/brotli.
- Cursor pagination never offset.
- Batch delivered receipts.
- Signed CDN for media.
- WS payload slim; avoid base64 media on WS.

---

## 4. Backend

- Indexes per `16-database.md`.
- Lateral join last message for list.
- Redis presence/typing.
- Connection pooling.
- Partition messages at scale.
- BullMQ off hot path.

---

## 5. Caching

| Layer | What |
|-------|------|
| Browser | static assets hashed |
| CDN | media |
| Redis | presence, RL, optional unread |
| TanStack | lists/messages |
| Prisma | none by default; read replicas later |

Invalidate on WS events.

---

## 6. Memory

- Cap decoded images in viewer LRU.
- RevokeObjectURL for local previews.
- Limit mounted message nodes via virtualizer.

---

## 7. Profiling Checklist

- React Profiler on send burst
- Chrome performance on scroll
- `EXPLAIN ANALYZE` chat list query
- Redis `INFO memory`
- k6/Artillery WS load test

---

*End of 23-performance.md*
