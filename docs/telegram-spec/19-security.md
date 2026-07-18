# 19 — Security

> Applies to the entire Telegram-inspired product. Security is a product feature (sessions, privacy, 2FA) and an engineering requirement.

---

## 1. Threat Model (summary)

| Threat | Mitigation |
|--------|------------|
| Account takeover | OTP rate limits, 2FA, session list, login alerts |
| Credential stuffing | Argon2id, RL, captcha later |
| IDOR on messages/files | Membership checks every query |
| XSS via messages | Strict sanitize/render; CSP |
| CSRF | Bearer tokens / SameSite cookies |
| Upload malware | MIME sniff, size caps, optional AV |
| Abuse/spam | RL, reports, bans |
| Session theft | Short access TTL, refresh rotation, https only |
| Privacy leaks | Server-side privacy enforcement |

---

## 2. Authentication Security

- Passwords: Argon2id (memory-hard); never log passwords.
- OTP: store only hash; 5–6 digits; TTL 5m; attempt caps.
- JWT access: 15m; signed HS256/RS256; include `sid`, `uid`, `jti`.
- Refresh: opaque random 32+ bytes; **hashed at rest**; rotate on use; detect reuse → revoke all.
- Optional Redis denylist for `jti` on logout.
- Device binding via `deviceId`.

---

## 3. Authorization

- Every conversation-scoped action verifies `ConversationMember`.
- Admin flags checked server-side — never trust client.
- File download: membership or signed URL with scoped object key.
- Channel posts: `canPost`.

---

## 4. Transport & Headers

- TLS everywhere in prod.
- HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- CSP: default-src self; media/img to CDN; connect-src API+WS.
- CORS: explicit origins from env — no `*` with credentials.

---

## 5. Message XSS / Markdown

- Parse to AST; render React elements — **never** `dangerouslySetInnerHTML` with raw user HTML.
- Autolink with `noopener noreferrer`.
- Limit nest depth of entities.

---

## 6. Upload Security

- Allowlist MIME; re-encode images.
- Random object keys (UUID); no user-controlled paths.
- Separate domain/CDN for untrusted content (`Content-Disposition` attachment for risky types).
- Rate limit uploads / user.

---

## 7. Privacy Enforcement

API redacts:
- phone, lastSeen, avatar per settings
- forwards may hide author if privacy requires (Telegram “forwarded as”)

Unit-test matrix for visibility enums.

---

## 8. Rate Limiting Matrix

| Endpoint class | Key | Limit |
|----------------|-----|-------|
| OTP request | phone+IP | 3 / 10m |
| OTP verify | phone | 5 / 15m |
| Login | IP+account | 10 / 15m |
| Send message | user | 60 / min soft |
| Upload | user | 30 / 10m |
| Search | user | 30 / min |
| Report | user | 10 / hour |

---

## 9. GDPR / Account Deletion

- Export request (Phase): zip messages metadata + media links.
- Delete: schedule; anonymize user; remove tokens; cascade memberships; soft-delete messages content per policy.
- Retain abuse logs minimally with legal basis.

---

## 10. Logging & PII

- Request IDs yes; message bodies **no** in info logs.
- Hash phones in logs.
- Admin access audited.

---

## 11. Dependency & Infra

- npm audit in CI; pin versions.
- Secrets in env/secret manager — never commit.
- DB least-privilege role; Redis AUTH; network policies.

---

## 12. Abuse Reporting

```http
POST /api/v1/users/:id/report
POST /api/v1/messages/:id/report
```
Store reports; rate limit; tooling later.

---

## 13. Security Testing Checklist

- [ ] IDOR attempts on messages/files
- [ ] XSS payloads in bio/messages
- [ ] Refresh reuse detection
- [ ] OTP brute force locked
- [ ] CORS negative tests
- [ ] Upload polyglot file
- [ ] WS join without membership

---

*End of 19-security.md*
