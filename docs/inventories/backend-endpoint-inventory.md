# Backend Endpoint Inventory

Target base: `/api/v1`. Current MVP may live under `/api` — migrate per `15-rest-api.md`.

## Auth
- POST `/auth/register`
- POST `/auth/login`
- POST `/auth/refresh`
- POST `/auth/logout`
- GET `/auth/me`
- POST `/auth/otp/request`
- POST `/auth/otp/verify`
- POST `/auth/2fa/verify`
- POST `/auth/qr/create`
- POST `/auth/qr/:token/scan|approve|reject`

## Users
- PATCH `/users/me`
- POST|DELETE `/users/me/avatar`
- GET `/users/:idOrUsername`
- GET `/users/:id/common-groups`
- GET|PATCH `/users/me/preferences`
- GET|PATCH `/users/me/privacy`
- GET|POST|DELETE `/users/me/blocks`
- POST|DELETE `/users/:id/block`
- POST `/users/:id/report`
- GET `/users/search`

## Sessions / Devices
- GET `/sessions`
- DELETE `/sessions/:id`
- POST `/sessions/revoke-others`
- POST|DELETE `/devices/push-token`

## Conversations
- GET `/conversations`
- POST `/conversations/direct|group|saved`
- GET|PATCH|DELETE `/conversations/:id`
- POST `/conversations/:id/pin`
- POST `/conversations/read-all`

## Messages
- GET `/conversations/:id/messages`
- POST `/conversations/:id/messages`
- GET `/conversations/:id/pinned`
- GET `/conversations/:id/messages/search`
- GET `/conversations/:id/shared`
- PATCH|DELETE `/messages/:id`
- POST `/messages/batch-delete|forward|batch-forward`
- POST `/messages/:id/pin|reactions`

## Drafts / Folders / Contacts
- PUT|DELETE `/drafts/:conversationId`
- GET|POST `/folders`
- PATCH|DELETE `/folders/:id`
- POST `/folders/:id/conversations`
- GET|POST `/contacts`
- DELETE `/contacts/:userId`

## Groups / Channels / Invites
- Group member/role/ban/transfer/invite/join-request routes
- Channel create/discussion/stats routes
- POST `/invites/:code/join`
- GET `/invites/:code`

## Uploads / Search / Calls / Health
- POST `/uploads/initiate` · POST `/uploads/:id/complete` · POST `/upload`
- GET `/search` · GET|DELETE|POST `/search/recent`
- GET `/calls/history` · POST `/calls/rooms`
- GET `/health` · GET `/meta/countries`

**Implemented today (approx):** auth CRUD, users me, conversations CRUD-ish, messages CRUD+actions, upload, search, health — see codebase controllers.
