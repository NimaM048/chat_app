# Architecture Notes

## Request path

1. Browser hits Nginx (`:80`)
2. Static UI → `web` container
3. REST `/api/*` and uploads → `api` container
4. Socket.IO `/socket.io/*` → `api` with `Upgrade` headers

## Auth

- Access JWT (short-lived) + refresh JWT (hashed in DB)
- Passwords hashed with Argon2
- Socket auth via `handshake.auth.token`

## Messaging

- Persist first (Postgres), then broadcast (`message:new`)
- Frontend prefers REST send for reliability
- Socket used for live fan-out, typing, presence, seen

## Presence / rate limit

- Redis when available
- In-memory fallback for local demos without Redis

## Media

- Multipart upload to `/api/upload`
- Files served from `/uploads/*`
- Message types: `TEXT | IMAGE | FILE | VOICE`
