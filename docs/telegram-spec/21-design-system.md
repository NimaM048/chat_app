# 21 — Design System

---

## 1. Principles

1. **Density for power users** — chat is a tool; maximize content.
2. **Speed** — optimistic UI; ≤200ms feedback.
3. **Cloud-first honesty** — connection banners, sync states.
4. **Minimal chrome** — content over cards.
5. **Familiar, not cloned pixel-perfect** — inspired by Telegram, original brand.

---

## 2. Color Tokens

Accent inspired by Telegram blue — **not** purple-on-white gradients.

```css
:root {
  --brand: #2AABEE;
  --brand-hover: #1E9AD8;
  --brand-subtle: rgba(42, 171, 238, 0.12);

  --bg: #FFFFFF;
  --bg-chat: #A5BDC8; /* or patterned wallpaper overlay */
  --surface: #FFFFFF;
  --surface-2: #F1F3F5;
  --text: #0E1621;
  --text-muted: #707579;
  --border: #E4E7EA;
  --danger: #E53935;
  --success: #31B545;
  --warning: #F0A000;

  --bubble-in: #FFFFFF;
  --bubble-out: #EEFFDE;
  --tick-seen: #4FC3F7;
}

[data-theme="dark"] {
  --bg: #0E1621;
  --bg-chat: #0E1621;
  --surface: #17212B;
  --surface-2: #232E3C;
  --text: #F5F5F5;
  --text-muted: #8B98A5;
  --border: #0E1621;
  --bubble-in: #182533;
  --bubble-out: #2B5278;
  --brand: #2AABEE;
}
```

Wallpaper: subtle pattern or soft photographic texture — avoid flat empty gray; avoid cream+terracotta AI cliché.

---

## 3. Typography

Avoid Inter/Roboto/Arial as identity fonts.

| Role | Font proposal |
|------|----------------|
| UI chrome | **Geist** or **IBM Plex Sans** |
| Messages | Geist / system-ui stack for perf |
| Mono/code | **IBM Plex Mono** / Geist Mono |

Scale: 12 / 13 / 14 / 16 / 20 / 24 / 32  
Chat body default **14–15px**; user-scalable via settings.

---

## 4. Spacing & Radius

- Base **4px**; row padding 8–12; list width 420.
- Radius: controls 8–10; bubbles 12–16 with asymmetric tail corners; sheets 12 top.
- Shadows: single soft `0 1px 2px rgba(0,0,0,.08)` — no glow stacks.

---

## 5. Motion Tokens

| Token | Value |
|-------|-------|
| `--dur-1` | 120ms |
| `--dur-2` | 200ms |
| `--dur-3` | 320ms |
| `--ease-standard` | cubic-bezier(0.2, 0.8, 0.2, 1) |
| `--ease-emphasized` | cubic-bezier(0.2, 0, 0, 1) |

Respect `prefers-reduced-motion: reduce`.

Intentional motions (ship ≥2–3): (1) bubble enter, (2) pane transitions, (3) reaction pop.

---

## 6. Z-Index Scale

```
base 0 | sticky 10 | header 20 | dropdown 40 | modal 50 | toast 60 | media-viewer 70 | call-overlay 80
```

---

## 7. Icons

Lucide or custom set; 20/24px; 1.5–2 stroke; optical align with text.

---

## 8. Breakpoints

`sm 600` · `md 900` · `lg 1080` · `xl 1400`

---

## 9. Do / Don’t

**Do:** accent blue, dense lists, clear unread pills, honest offline states.  
**Don’t:** purple gradients, glassmorphism overload, emoji as UI icons, card grids for chats, inset hero marketing in app shell.

---

*End of 21-design-system.md*
