# Proposed Folder Structure

Target monorepo layout for the Telegram-inspired chat platform. Items marked *(exists)* are already present.

```
chat_app/                          (exists)
├── apps/
│   ├── api/                       (exists) NestJS
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── auth/
│   │   │   ├── user/
│   │   │   ├── chat/              # split over time ↓
│   │   │   ├── conversation/      # (target extract)
│   │   │   ├── message/           # (target extract)
│   │   │   ├── group/             # (target)
│   │   │   ├── channel/           # (target)
│   │   │   ├── presence/          # (target)
│   │   │   ├── notification/      # (target)
│   │   │   ├── upload/
│   │   │   ├── search/            # (target)
│   │   │   ├── calls/             # (target)
│   │   │   ├── folder/            # (target)
│   │   │   ├── contact/           # (target)
│   │   │   ├── rate-limit/
│   │   │   ├── health/
│   │   │   ├── database/
│   │   │   ├── config/
│   │   │   └── common/
│   │   │       ├── filters/
│   │   │       ├── interceptors/
│   │   │       ├── guards/
│   │   │       └── dto/
│   │   ├── test/
│   │   └── Dockerfile
│   └── web/                       (exists) React + Vite
│       ├── src/
│       │   ├── main.tsx
│       │   ├── routes/
│       │   ├── pages/
│       │   ├── components/
│       │   │   ├── ui/
│       │   │   ├── layout/
│       │   │   ├── chat/
│       │   │   ├── auth/
│       │   │   ├── search/
│       │   │   ├── profile/
│       │   │   ├── settings/
│       │   │   ├── media/
│       │   │   └── calls/
│       │   ├── hooks/
│       │   ├── stores/
│       │   ├── lib/
│       │   ├── types/
│       │   └── assets/
│       ├── e2e/
│       └── Dockerfile
├── packages/
│   └── shared/                    # (target) DTOs, WS event names, zod schemas
│       ├── src/
│       │   ├── events.ts
│       │   ├── dto/
│       │   └── index.ts
│       └── package.json
├── docker/
│   └── nginx/                     (exists)
├── docs/
│   ├── telegram-spec/             (exists) PRD/TDD 00–26
│   ├── inventories/               (exists)
│   ├── schemas/                   (exists) prisma proposal, openapi later
│   ├── architecture/              (exists)
│   ├── architecture.md
│   ├── roadmap.md
│   └── readme.me
├── docker-compose.yml
├── package.json
└── README.md
```

## Service Boundaries (API)

| Module | Responsibility |
|--------|----------------|
| AuthModule | OTP, JWT, sessions, QR, 2FA |
| UserModule | profile, privacy, blocks |
| ConversationModule | list, membership settings |
| MessageModule | CRUD, reactions, forward |
| GroupModule | roles, invites, bans |
| ChannelModule | posts, stats, discussion |
| PresenceModule | redis presence + gateway hooks |
| NotificationModule | push fanout + prefs |
| UploadModule | signed URLs, multipart |
| SearchModule | FTS + recent |
| CallsModule | rooms + signaling hooks |
| JobsModule | BullMQ processors |

## Repository Pattern

Each feature `*.repository.ts` wraps Prisma queries; services orchestrate + emit WS/jobs; controllers/gateways stay thin.

## Shared Package

`@chat-app/shared` exports event name constants and DTO types imported by api + web to prevent drift.
