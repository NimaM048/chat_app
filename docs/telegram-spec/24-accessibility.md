# 24 — Accessibility

Target: **WCAG 2.2 Level AA** for Web client.

---

## 1. Principles

- Keyboard parity for all pointer actions (except drawing).
- Visible focus rings (`:focus-visible`) using brand accent.
- Don’t rely on color alone (ticks + text “edited”; unread pill + bold title).
- Respect forced colors / high contrast where feasible.
- Honor `prefers-reduced-motion`.
- Touch targets ≥ 44×44 CSS px on mobile.

---

## 2. Landmarks & Structure

- `role="navigation"` chat list
- `role="main"` conversation
- Complementary info panel
- Skip link to composer

---

## 3. Chat-Specific

| Element | Requirement |
|---------|-------------|
| Chat row | Accessible name includes title, preview, unread, time |
| Message list | `aria-label="Messages"`; options/articles with sender + content + time |
| Composer | labelled textarea; announce reply/edit mode |
| Typing | polite live region throttled |
| New message when focused elsewhere | optional polite; never interrupt typing mid-word aggressively |
| Delivery ticks | `aria-label="Seen"` / Delivered / Sent |
| Reactions | button “👍, 3, reacted by you” |

---

## 4. Keyboard Map (core)

See `04-conversation.md` and `02-home.md`. Document in Settings → Accessibility help.

Focus order: search → list → header → messages → composer → attach.

Roving tabindex in lists.

---

## 5. Screen Reader Testing

- NVDA + Chrome (Windows)
- VoiceOver + Safari (macOS/iOS)
- TalkBack + Chrome (Android)

---

## 6. Media & Motion

- Videos captions if provided (future)
- Autoplay GIFs off when reduce motion
- Media viewer dialog semantics

---

## 7. Localization / RTL

- `dir` on `<html>` from language
- Mirror shell paddings; keep message `dir=auto`
- Pseudo-locale test

---

## 8. Color Contrast

Text muted ≥ 4.5:1 on surfaces; large text 3:1; UI components 3:1 non-text.

Verify dark bubble-out on dark theme.

---

## 9. Forms (Auth/Settings)

- Labels always; errors `aria-invalid` + `aria-describedby`
- OTP fields autocomplete `one-time-code`

---

## 10. Checklist for PRs

- [ ] Keyboard path verified
- [ ] Focus visible
- [ ] Contrast checked
- [ ] Live regions not noisy
- [ ] Icons have names or aria-hidden with text

---

*End of 24-accessibility.md*
