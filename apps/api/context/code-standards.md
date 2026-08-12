# Code Standards — Chat App API

## General

- One domain per module under `src/modules/`.
- Fix root causes; avoid workaround layers.
- One responsibility per service/controller method.

## TypeScript

- Strict mode enabled.
- Avoid `any`; use precise types at boundaries (DTOs + interfaces).
- Validate external input with `class-validator` DTOs.

## NestJS layout

```
modules/<domain>/
├── <domain>.module.ts
├── controllers/
├── services/          # when 2+ services
├── dto/
├── gateways/          # if WebSocket
├── constants/
└── (guards/decorators/strategies in auth only)
```

Single-service modules may place `<domain>.service.ts` at module root (`rate-limit`, `upload` pattern).

## Naming

| Artifact | Pattern |
|----------|---------|
| Module | `chat.module.ts` → `ChatModule` |
| Controller | `chat.controller.ts` → `ChatController` |
| Service | `message.service.ts` → `MessageService` |
| DTO | `send-message.dto.ts` or grouped `chat.dto.ts` |
| Spec | co-located `*.spec.ts` |

## Imports

- Relative paths only (`../../user/services/user.service`).
- Order: Node builtins → npm packages → project imports.
- ESLint rules: `import/order`, `import/no-duplicates`, `import/no-cycle` (warn).

## File size (god-file linter)

Production source (`src/**/*.ts`, excluding `*.spec.ts`):

- **max 400 lines** (`max-lines` with `skipBlankLines` + `skipComments`)
- Split into focused services/mappers/constants before hitting the limit

## API

- Global prefix: `api/v1`
- Consistent envelope: `{ success, data, message? }` or filter error shape
- JWT via `JwtAuthGuard`; `@CurrentUser()` for payload

## Data (Prisma)

- Schema: `prisma/schema.prisma`
- `PrismaService` is global via `database/prisma.module.ts`
- UTF-8 required for Persian/emoji (embedded Postgres uses `--encoding=UTF8`)

## Shared vs utils

- `shared/` — Nest injectables-adjacent types, filters, interceptors, middleware
- `utils/` — pure functions (`sanitize-user`, `cors-origin`)

## Tests

- Unit tests co-located under `services/*.spec.ts`
- Run: `npm run test:api`
