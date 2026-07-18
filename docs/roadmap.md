# Chat App — Recommended Build Plan

این سند **برنامه پیشنهادی من** برای ساخت پروژه رزومه‌ای است.  
هدف: یک اپ چت **کامل، polish‌شده و شبیه تلگرام** — نه لیست بلند تکنولوژی‌های نصفه.

مرجع قوانین مهندسی: [`docs/readme.me`](./readme.me)

---

## اصل کلی (قبل از فازها)

| اولویت | معنی |
|--------|------|
| عمق > عرض | ۵–۷ قابلیت عالی بهتر از ۲۰ قابلیت نصفه |
| Demo-ready | هر فاز باید قابل اجرا و قابل نمایش باشد |
| Telegram UX | حس تلگرام: سریع، خلوت، آشنا، dark/light |
| یک صف / یک بروکر | **BullMQ + Redis** — RabbitMQ را عمداً عقب می‌اندازیم |
| یک ORM | **Prisma** |
| Real-time | **Socket.IO** |

### چرا این برش؟

برای رزومه، recruiter این‌ها را می‌بیند:

1. آیا واقعاً کار می‌کند؟
2. آیا معماری تمیز است؟
3. آیا UX حرفه‌ای است؟
4. آیا deploy و README داری؟

تعداد پکیج‌ها به‌تنهایی امتیاز نیست.

---

## UI / UX Direction — Telegram-inspired

الهام از تلگرام؛ کپی پیکسل‌به‌پیکسل لازم نیست. حس و الگوها مهم است.

### Layout (Desktop)

```
┌────────────┬──────────────────────────────┐
│  Sidebar   │         Chat Header          │
│  (chats)   ├──────────────────────────────┤
│            │                              │
│  search    │       Message List           │
│  list      │       (bubbles)              │
│            │                              │
│            ├──────────────────────────────┤
│            │       Composer               │
└────────────┴──────────────────────────────┘
```

### Layout (Mobile)

- لیست چت‌ها تمام‌صفحه
- ورود به چت = صفحه جدا + back
- Composer ثابت پایین

### اصول بصری

- **بدون کارت اضافی** در ناحیه چت — فقط حباب‌ها و فضای تنفس
- حباب‌های خودت: رنگ برند (مثلاً آبی/سبز ملایم)، طرف مقابل: خاکستری سطح دوم
- فاصله‌گذاری فشرده و خوانا مثل تلگرام (نه dashboard شلوغ)
- Typography واضح؛ خوانایی پیام اولویت دارد
- Dark / Light با contrast درست (نه فقط invert رنگ)
- انیمیشن با Framer Motion: **subtle** — ورود حباب، جابه‌جایی لیست، switch تم
- آیکون‌ها: **Lucide**
- Scroll نرم، sticky date separators، jump-to-bottom

### رفتارهای UX اجباری (از فاز ۲ به بعد)

- Optimistic send (پیام فوری در UI، بعد sync)
- Typing indicator زیر هدر / بالای composer
- Seen / delivered با تیک‌های آشنا
- Long-press / context menu برای Reply / Pin / Forward / Copy
- Skeleton هنگام لود لیست و تاریخچه
- Empty states خلوت و مفید

### پشته UI

- Tailwind + shadcn/ui (پایه کنترل‌ها)
- Framer Motion (transitionها)
- emoji-mart (picker)
- react-dropzone (فایل)
- Web Audio API (ضبط ویس)
- Zustand (UI state: sidebar, theme, active chat, composer)
- TanStack Query (server state: conversations, messages, user)

---

## Tech Stack (نسخه نهایی پیشنهادی)

### Backend

- NestJS + TypeScript (strict)
- PostgreSQL + Prisma
- Redis (presence, cache, rate limit, pub/sub)
- BullMQ (jobs: media process, notifications later)
- Socket.IO
- JWT (access + refresh) + Argon2
- Swagger
- Jest
- Docker

### Frontend

- React + TypeScript + Vite
- Tailwind + shadcn/ui + Framer Motion
- Zustand + TanStack Query + React Router
- Lucide + emoji-mart + react-dropzone
- Vitest + Playwright

### Infrastructure

- Docker Compose: `api`, `web`, `postgres`, `redis`, `nginx`
- Nginx reverse proxy (API + static + WS upgrade)

### عمداً عقب‌افتاده (فاز اختیاری / بعد از رزومه)

- RabbitMQ
- Microservices زیاد
- Group chat پیشرفته (ادمین، نقش‌ها، دعوت لینک)
- Calls / WebRTC

---

## ساختار Monorepo پیشنهادی

```text
chat_app/
├── apps/
│   ├── api/                 # NestJS
│   └── web/                 # React + Vite
├── packages/                # اختیاری: shared types
│   └── shared/
├── docker/
│   ├── nginx/
│   └── ...
├── docs/
│   ├── readme.me            # engineering rules
│   └── roadmap.md           # this file
├── docker-compose.yml
└── README.md                # user-facing
```

---

# فازها

## فاز ۰ — Foundation (۱–۲ روز)

هدف: اسکلت پروژه که همه روی یک دستور بالا بیاید.

### Deliverables

- [ ] Monorepo: `apps/api` + `apps/web`
- [ ] NestJS bootstrap + strict TS + config module
- [ ] Vite React + TS + Tailwind + path aliases
- [ ] shadcn/ui init + theme tokens (light/dark)
- [ ] Prisma + PostgreSQL schema خالی اولیه
- [ ] Docker Compose: postgres + redis (+ api/web بعداً)
- [ ] `.env.example`
- [ ] README اولیه: چگونه پروژه را بالا بیاوریم

### Done یعنی

`docker compose up` دیتابیس و Redis را می‌آورد و API health check می‌دهد.

---

## فاز ۱ — Auth + Shell تلگرامی (هفته ۱) ✅ اولویت فعلی

هدف: کاربر ثبت‌نام/ورود کند و وارد **پوسته UI شبیه تلگرام** شود — حتی بدون پیام واقعی هنوز.

این فاز پایه همه چیز است. اگر این تمیز باشد، بقیه فازها سریع جلو می‌روند.

### Backend

- [ ] Module: `auth`, `user`
- [ ] Prisma models: `User`, `RefreshToken` (یا معادل امن)
- [ ] Register / Login / Logout / Refresh
- [ ] Argon2 password hashing
- [ ] JWT access + refresh
- [ ] Auth guards + current-user decorator
- [ ] Swagger برای auth endpoints
- [ ] Validation (DTO) + consistent error responses
- [ ] Rate limit پایه روی login/register (Redis)

### Frontend

- [ ] Routes: `/login`, `/register`, `/app` (protected)
- [ ] Auth forms تمیز (shadcn)
- [ ] Token storage امن و refresh flow
- [ ] **Telegram shell:**
  - Sidebar خالی (جستجو + لیست placeholder)
  - پنل چت خالی (empty state: «Select a chat»)
  - Header با آواتار/نام کاربر
  - Theme toggle Dark / Light
- [ ] Layout responsive: desktop split / mobile stack
- [ ] Framer Motion: page transition ملایم + theme fade

### UX جزئیات فاز ۱

- فونت و رنگ‌ها از روز اول Telegram-like تعریف شوند (CSS variables)
- Sidebar عرض ثابت (~320–380px در دسکتاپ)
- Empty state مرکزی، نه کارت‌های بازاری
- Loading / error states برای auth

### Tests

- [ ] Backend: auth service unit tests (register, login, refresh)
- [ ] Frontend: حداقل یک تست فرم login (Vitest)

### Done یعنی

1. Register → Login → ورود به `/app`
2. Layout شبیه تلگرام دیده می‌شود (حتی بدون چت واقعی)
3. Dark/Light کار می‌کند
4. Swagger auth مستند است
5. می‌توانی از این فاز GIF کوتاه برای رزومه بگیری (بعداً)

### Out of scope فاز ۱

- پیام، socket، فایل، ویس، reply، pin
- RabbitMQ
- Playwright کامل

---

## فاز ۲ — Conversations + Real-time Messaging (هسته محصول)

هدف: چت ۱-به‌-۱ واقعی مثل تلگرام.

### Backend

- [ ] Models: `Conversation`, `ConversationMember`, `Message`
- [ ] REST: لیست مکالمات، ساخت DM، history با cursor pagination
- [ ] Socket.IO gateway: join room، send message، ack
- [ ] Persist + broadcast
- [ ] Redis presence (online/offline)
- [ ] Typing events
- [ ] Delivered / Seen events + DB fields

### Frontend

- [ ] Sidebar: لیست چت واقعی + last message + unread badge
- [ ] Chat bubbles (own / other)
- [ ] Composer (ارسال متن + Enter)
- [ ] Typing indicator
- [ ] Seen / delivered UI
- [ ] Infinite scroll history
- [ ] Optimistic UI با TanStack Query + socket invalidate/patch
- [ ] Reconnect handling

### Done یعنی

دو کاربر همزمان تایپ و پیام می‌بینند؛ seen کار می‌کند.

---

## فاز ۳ — Message Actions + Polish UX

هدف: حس قدرت تلگرام در تعامل با پیام.

### Features

- [ ] Reply (UI + payload + preview)
- [ ] Forward
- [ ] Pin message (pinned bar زیر هدر)
- [ ] Context menu / long-press
- [ ] Emoji picker (`emoji-mart`)
- [ ] Search در لیست چت‌ها
- [ ] Skeletonها و micro-animations

### Done یعنی

یک فلو کامل: send → reply → pin → forward بدون باگ واضح.

---

## فاز ۴ — Media (File + Voice)

هدف: تمایز قوی در demo رزومه.

### Features

- [ ] Upload فایل با `react-dropzone` + API upload
- [ ] پیش‌نمایش تصویر / فایل در حباب
- [ ] Voice message UI + ضبط با **Web Audio API**
- [ ] BullMQ job برای پردازش/optimize اختیاری (مثلاً thumbnail)
- [ ] Progress / failed state

### Done یعنی

ارسال عکس و ویس در دمو ۳۰ ثانیه‌ای دیده می‌شود.

---

## فاز ۵ — Production Hardening + Resume Pack

هدف: پروژه «قابل نشان دادن به شرکت» شود.

### Infra & Quality

- [ ] Dockerfiles برای api/web
- [ ] Nginx (HTTP + WebSocket upgrade)
- [ ] Health checks
- [ ] Structured logging + request id
- [ ] چند Playwright e2e: login → chat → send
- [ ] Jest پوشش مسیرهای حیاتی socket/auth

### Resume artifacts

- [ ] README حرفه‌ای: معماری، اسکرین، GIF، نحوه اجرا
- [ ] Architecture diagram ساده
- [ ] Deploy (VPS یا مشابه) — لینک live
- [ ] ۳ bullet قوی برای رزومه

### Done یعنی

یک نفر غریبه با README پروژه را بالا می‌آورد و در ۲ دقیقه دمو می‌گیرد.

---

## فاز ۶ (اختیاری) — Extra Credit

فقط اگر فاز ۱–۵ کامل و polish شده:

- Group chat
- RabbitMQ برای notification email
- Message edit / delete for everyone
- Link preview
- Push notifications

---

## ترتیب اجرای پیشنهادی من (خلاصه)

```text
فاز ۰  Foundation
  ↓
فاز ۱  Auth + Telegram Shell     ← الان اینجا شروع کن
  ↓
فاز ۲  Real-time Chat Core
  ↓
فاز ۳  Reply / Pin / Forward / Emoji
  ↓
فاز ۴  File + Voice
  ↓
فاز ۵  Docker / Nginx / Tests / README / Deploy
  ↓
فاز ۶  Optional extras
```

---

## تعریف «رزومه قوی» برای این پروژه

پروژه وقتی برای رزومه **بسیار قوی** است که:

1. Live یا حداقل Docker one-command داشته باشد
2. Demo GIF از typing + seen + (ترجیحاً) voice داشته باشد
3. کد NestJS ماژولار و قابل توضیح در interview باشد
4. UI بلافاصله حس messaging app واقعی بدهد (تلگرام‌گونه)
5. README تصمیم‌های فنی را توضیح دهد (چرا Redis، چرا BullMQ، چرا Socket.IO)

---

## وضعیت فعلی

| مورد | وضعیت |
|------|--------|
| Engineering rules | ✅ `docs/readme.me` |
| Roadmap | ✅ این فایل |
| فاز ۱ — Auth + Telegram Shell | ✅ |
| فاز ۲ — Real-time Chat | ✅ |
| فاز ۳ — Reply / Pin / Forward / Emoji | ✅ |
| فاز ۴ — File + Voice | ✅ |
| Encoding fix (UTF-8 Persian) | ✅ |
| فاز ۵ — Docker / Nginx / Tests / Resume pack | ✅ |
| فاز فعال بعدی | **فاز ۶ — Optional extras (groups, edit/delete, ...)** |

---

## نکته برای Cursor / توسعه

در هر session فقط روی **یک فاز** کار کن.  
قبل از رفتن به فاز بعد، چک‌لیست همان فاز باید Done باشد.  
UI همیشه با معیار «آیا شبیه حس تلگرام است؟» review شود — نه dashboard شلوغ.
