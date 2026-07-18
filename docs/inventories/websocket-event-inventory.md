# WebSocket Event Inventory

Namespace target: `/ws` (current: `/chat`).

## Client → Server
| Event | Status |
|-------|--------|
| `conversation:join` | ✅ |
| `conversation:leave` | 🟡 |
| `message:send` | ✅ (REST preferred) |
| `typing:start` | ✅ |
| `typing:stop` | ✅ |
| `message:delivered` | ✅ |
| `conversation:seen` | ✅ |
| `presence:ping` | 🟡 |
| `focus:set` | ⛔ |
| `call:invite\|accept\|reject\|end\|signal` | ⛔ |

## Server → Client
| Event | Status |
|-------|--------|
| `message:new` | ✅ |
| `message:updated` | ✅ |
| `message:deleted` | 🟡 |
| `message:status` | ✅ |
| `reaction:updated` | 🟡 via message:updated |
| `typing:update` | ✅ |
| `presence:update` | ✅ |
| `conversation:updated` | ✅ |
| `conversation:seen` | ✅ |
| `draft:updated` | ⛔ |
| `session:revoked\|created` | ⛔ |
| `group:*` / `channel:*` | ⛔ |
| `qr:*` | ⛔ |
| `call:*` | ⛔ |
| `error` | 🟡 |

Details & DTOs: `14-websocket-events.md`.
