# 12 — Files & Voice Messages

> **MVP Status:** ✅ Multipart upload (~15MB), image/file bubbles, voice via MediaRecorder. 🟡 Progress/cancel/retry polish, drag-drop/paste, waveforms, playback speed. ⛔ 2GB target, S3 signed uploads, video notes, server virus scan.

---

## 1. File Upload — Purpose

Move bytes from client to cloud storage and create a message referencing them, with reliable progress and failure recovery.

---

## 2. Entry Points

1. Attach menu → File / Photo
2. Drag & drop onto conversation
3. Paste from clipboard (image/files)
4. Share intent (mobile OS)
5. Camera capture

### UX Flow
1. User selects file(s).
2. Preview chips in composer (name, size, remove).
3. Optional compression choice for images/videos.
4. On send: create upload task(s) → progress on chip/bubble → `POST message` with `fileUrl` / `uploadId`.
5. Failure: error state + Retry / Cancel.

### Progress / Cancel / Retry
- XHR/fetch upload with progress events.
- Cancel aborts & deletes incomplete server object.
- Retry resumes if server supports resumable (TUS/S3 multipart); MVP: full retry.

### Limits
| Stage | Limit |
|-------|-------|
| Current MVP | 15 MB |
| Target product | 2 GB (multipart) |
| Images compressed default | longest edge 2560 / quality ~0.8 |
| Max files per album | 10 |
| Max concurrent uploads | 3 |

### Validation
- Blocked extensions executable list (`.exe`, `.bat`, …) configurable; or allow with warning (Telegram allows many types).
- MIME sniff server-side; don’t trust client.
- Empty file rejected.

### API (target)
```http
POST /api/v1/uploads/initiate
{ "fileName": "a.pdf", "mimeType": "application/pdf", "size": 12345 }
→ { "uploadId": "...", "uploadUrl": "https://s3...(signed)", "headers": {} }

POST /api/v1/uploads/:id/complete
→ { "fileUrl": "...", "thumbUrl": null }

# MVP current
POST /api/upload  multipart
```

### DB
Message media fields already exist (`fileUrl`, `fileName`, `fileSize`, `mimeType`). Add `uploadId`, `sha256` optional.

### BullMQ
`media.process`: thumbnail, PDF preview, virus scan, waveform for voice.

### Edge Cases
- Network drop mid-upload.
- Duplicate paste spam → debounce.
- Directory drag ignored.
- Oversize → immediate client error before network.

### A11y / Platforms / Animation
- Progressbars labelled by filename.
- Mobile share sheet; Desktop drag overlay “Drop to upload” 150ms fade.
- Loading bubble shimmer until URL ready.

---

## 3. Download

- Tap file → download / open.
- Progress for large files; cancel.
- “Open with” OS handler on desktop.
- Shared Files tab lists downloadable history.

---

## 4. Voice Messages

### Recording UX
1. Hold mic: record; UI timer + waveform live.
2. Slide left: cancel (red).
3. Slide up: lock recording.
4. Locked: Send / Cancel / Trash / Pause (if supported).
5. Preview before send optional setting.

### Playback
- Waveform seekable.
- Speeds 1×, 1.5×, 2× persisted.
- Pause/resume; stop at end.
- “Listened” state optional dimming play icon for incoming.

### Data
- `audio/webm` or `audio/ogg` / `audio/mp4` (AAC) — normalize server-side if needed.
- `durationMs`, `waveform` peaks (e.g. 63 bars 0–31).

### API
Same as file message `type: VOICE`.

### Edge Cases
- Mic permission denied → settings CTA.
- Interrupt by call → auto-save draft voice or cancel with confirm.
- Max duration hit → auto-stop and prompt send.
- Silent audio warning.

### Animation
- Mic pulse while recording; lock spring; waveform draw 16ms RAF.

> **MVP Status:** ✅ Basic record/send; speed/lock polish 🟡

---

## 5. Video Notes / Round Videos

Telegram circular video messages. **Phase 9:** record front-camera square/circle crop, `type: VIDEO_NOTE`.

---

## 6. Storage Quotas

- Per-user soft quota optional enterprise.
- Cache clear local; cloud unlimited product promise like Telegram for MVP scale caution — set practical caps.

---

## 7. Security

- Signed URLs; authz check on download for private media (`GET /files/:id` with membership).
- Don’t expose other users’ uploads by enumerable IDs without authz.
- Rate limit upload initiates.

---

## 8. Testing

- [ ] Drag-drop multi-file
- [ ] Paste image
- [ ] Cancel mid-upload
- [ ] Voice lock/cancel
- [ ] Playback seek/speed
- [ ] Oversize rejected
- [ ] Authz on download

---

*End of 12-files.md*
