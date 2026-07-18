# 25 — Testing Strategy

---

## 1. Pyramid

| Layer | Tool | Scope |
|-------|------|-------|
| Unit | Jest (API), Vitest (web) | services, utils, reducers |
| Component | Vitest + Testing Library | composer, bubbles, auth forms |
| Integration | Jest e2e / supertest | auth+chat API |
| E2E | Playwright | critical user journeys |
| Load | k6/Artillery | WS + send message |
| Security | OWASP ZAP light + custom IDOR scripts | |
| A11y | axe-core in Playwright | shell + conversation |

---

## 2. Coverage Targets

- API domain services ≥ 70% statements (raise over time)
- Critical auth/chat paths 100% of happy+abuse cases listed below
- Do not chase 100% UI snapshot coverage

---

## 3. Critical Path Inventory

1. Register → login → open Saved → send text → logout
2. Login two users → DM → typing → seen
3. Reply / edit / delete / react / forward / pin
4. Upload image + voice
5. Reconnect restores gap
6. Refresh token rotation
7. Archive / mute (when server)
8. Search finds message
9. Group create + send
10. Session revoke

---

## 4. Fixtures & Seed

- `npm run seed` alice/bob
- Factory helpers for conversations/messages
- Deterministic UUIDs in unit tests

---

## 5. CI Matrix

On PR:
- lint + typecheck
- unit api + web
- Playwright smoke (auth + send if services up)
- docker build optional nightly

---

## 6. Flakiness Rules

- No arbitrary sleeps; wait for assertions
- Isolate DB per test worker or transactions
- WS tests with auth token fixtures

---

## 7. Load Test Scenario

- 1k concurrent sockets
- 100 msg/s aggregate
- Assert p99 fanout and error rate < 0.1%

---

## 8. Security Tests

From `19-security.md` checklist automated where possible.

---

*End of 25-testing.md*
