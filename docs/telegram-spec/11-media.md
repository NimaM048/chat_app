# 11 — Media

> **MVP Status:** 🟡 Image send + basic preview in bubbles. Full-screen media viewer with albums, zoom, keyboard nav, shared media gallery, spoiler, editor, and Stories deferred/partial.

---

## 1. Purpose

Media viewer is a focused lightbox for images/videos/GIFs/albums with download and message actions—without leaving chat context.

---

## 2. Media Viewer

### UI Layout
- Full-bleed black/scrim canvas.
- Current media centered; contain-fit default.
- Top bar: close, chat title, more menu.
- Bottom: caption (if any), index `2 / 12` for albums, download.
- Side chevrons desktop; swipe mobile.

### UX Behavior
- Open from bubble tap / profile avatar.
- Esc/close returns to same scroll position.
- Wheel/pinch zoom; double-click toggle zoom; drag pan when zoomed.
- Arrow keys navigate album / chat media chronologically (load neighbors).
- Video: play/pause, seek, volume, fullscreen, playback rate.
- Context menu: Save as, Forward, Delete, Show in chat, Copy image, Set as wallpaper (image).

### States
`loading` | `ready` | `error` | `zoomed` | `playing`

### Edge Cases
- Media deleted while open → close with toast.
- Partial album download failure → retry tile.
- Extremely large image → downsample decode.
- Spoiler: require tap to reveal before clear view.

### API
Uses message file URLs; navigation via:
```http
GET /api/v1/conversations/:id/shared?type=media&aroundId=&limit=
```

### Animation
- Open: 200ms shared-element style scale from thumb if possible.
- Fade neighbors 150ms.
- Reduced motion: fade only.

### A11y
- Dialog modal; focus trap; announce caption; video controls keyboardable.

### Mobile / Desktop
- Mobile: swipe vertical close (Telegram-like).
- Desktop: zoom toward cursor.

---

## 3. Albums

- Grouped by `albumId` on send (2–10 items).
- Grid in bubble; viewer opens at tapped index.
- Caption on album last item or shared caption field.

```prisma
Message.albumId String?
Message.albumIndex Int?
```

---

## 4. Compression vs Original

Send sheet: **Compress** (default photos) vs **File / Original**.  
Videos: quality picker. Server may further transcode via BullMQ `media.process` (poster, variants).

---

## 5. Photo Editor (Phased)

Telegram: crop, draw, text, stickers, spoiler.  
**Our plan:** Phase 5 basic crop/rotate; Phase 9 draw/text. Spec UI: bottom tools, cancel/send.

---

## 6. Shared Media Gallery

In profile/info tabs — see `09-profile.md`. Grid virtualized; multi-select forward/delete.

---

## 7. Stories

Telegram Stories exist on mobile clients heavily. **Decision: ⛔ Deferred.** Placeholder only in Home spec.

---

## 8. Backend / Storage

- Original + `thumb` + optional `preview` objects in S3.
- Signed GET URLs TTL 1h; CDN cache.
- Virus scan job optional before public.

### Realtime
`message:updated` when processing completes (replace processing placeholder).

---

## 9. Performance

- BlurHash/LQIP placeholders.
- Prefetch next/prev in viewer.
- Cancel decode on rapid navigate.

---

## 10. Testing

- [ ] Zoom/pan bounds
- [ ] Album keyboard nav
- [ ] Delete updates viewer
- [ ] Spoiler reveal
- [ ] a11y dialog

---

*End of 11-media.md*
