# Chat App API — Agent Guide

Operating guide for NestJS backend structure in `apps/api`. Follow this before adding features.

## Stack

- **NestJS + TypeScript** modular API
- **Prisma + PostgreSQL** (migrations in `prisma/migrations/`, never edit by hand)
- **Socket.IO** realtime (`/ws` namespace)
- **Redis** optional (rate limit + presence; in-memory fallback when unset)
- **Config** via `@nestjs/config` + `src/configs/env.validation.ts`

## Folder layout (life-sign-back style)

```
src/
├── main.ts
├── app.module.ts
├── configs/          # env validation + AppConfigModule (+ index barrel)
├── database/         # PrismaModule + PrismaService
├── shared/           # cross-cutting filters, interceptors, middleware, interfaces
├── utils/            # pure helpers (no DI)
└── modules/
    ├── auth/
    ├── user/
    ├── chat/
    ├── upload/
    ├── rate-limit/
    └── health/
```

## Module internal layout

Each domain under `src/modules/<domain>/`:

| Subfolder | Purpose |
|-----------|---------|
| `controllers/` | HTTP controllers (thin) |
| `services/` | Business logic (multi-service modules) |
| `dto/` | Request validation DTOs |
| `gateways/` | WebSocket gateways (chat) |
| `constants/` | Enums, selects, helpers |
| `guards/`, `decorators/`, `strategies/` | Auth-owned cross-cutting (in `auth/`) |

### Service placement rule

- **One service** → file at module root (e.g. `rate-limit.service.ts`)
- **Two or more services** → `services/` folder (e.g. `chat/services/message.service.ts`)

When a service grows, split by responsibility into new files under `services/` — never add a monolithic facade.

## Current domain map

| Module | Services |
|--------|----------|
| `auth` | `AuthService`, `SessionService` |
| `user` | `UserService`, `PreferenceService`, `PrivacyService`, `BlockService` |
| `chat` | `ConversationService`, `MessageService`, `DraftService`, `ReactionService`, `SearchService`, `PresenceService`, `ChatMapperService` |
| `upload` | controller-only (single endpoint) |
| `rate-limit` | `RateLimitService` at module root |
| `health` | `HealthController` only |

## Invariants

1. **No god files** — production `.ts` files stay under **400 lines** (ESLint `max-lines`).
2. **Import order** — enforced via `eslint-plugin-import` (builtin → external → internal, alphabetized, blank lines between groups).
3. **Relative imports only** — no path aliases; no barrel exports inside modules (configs barrel is the exception).
4. **Controllers stay thin** — validation via DTOs + global `ValidationPipe`; logic in services.
5. **Prisma migrations** — generate only; never hand-edit migration SQL.
6. **Secrets** — only in `.env`, validated through `configs/env.validation.ts`.

## Adding a new domain module

1. Create `src/modules/<domain>/<domain>.module.ts`
2. Add `controllers/`, and `services/` if more than one service
3. Register in `app.module.ts`
4. Keep files under 400 lines; split early

## Before completing work

1. `npm run build -w @chat-app/api`
2. `npm run test:api`
3. `npm run lint -w @chat-app/api`

See also: [context/code-standards.md](./context/code-standards.md)
