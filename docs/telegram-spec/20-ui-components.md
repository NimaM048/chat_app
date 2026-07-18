# 20 — UI Components

> Inventory of reusable components for `apps/web`. Prefer Radix + shadcn-style primitives already in the repo; extend rather than duplicate.

---

## Design Mapping

Telegram density + our tokens (`21-design-system.md`). Cards are **not** used in heroes/chat list rows; use rows/panels.

---

## Component Catalog

### Button
- Variants: `default` (accent), `secondary`, `ghost`, `destructive`, `outline`, `link`
- Sizes: `sm` `md` `lg` `icon`
- States: default hover active disabled loading
- A11y: focus ring; `aria-busy` when loading
- Path: `components/ui/button.tsx`

### Input / Textarea
- States: default focus error disabled
- Props: `error`, `startAdornment`, `endAdornment`
- Composer uses autosize Textarea variant
- Path: `components/ui/input.tsx`, `textarea.tsx`

### Avatar
- Sizes 24/32/40/48/96; fallback initials; online badge slot
- Path: `components/ui/avatar.tsx`

### Badge / UnreadPill
- Count `99+`; mention `@`; mute icon companion
- Path: `components/ui/badge.tsx`

### Dialog / Modal / AlertDialog
- Confirm destructive actions (delete, leave, terminate sessions)
- Focus trap; Esc; return focus
- Path: `components/ui/dialog.tsx`

### Sheet / Drawer
- Mobile profile, attach menus, settings subsections
- Path: `components/ui/sheet.tsx`

### DropdownMenu / ContextMenu
- Desktop right-click message/chat; overflow menus
- Path: `components/ui/dropdown-menu.tsx`, `context-menu.tsx`

### Tabs
- Search tabs; shared media; settings segments
- Path: `components/ui/tabs.tsx`

### Tooltip
- Icon buttons; truncated titles
- Delay 400ms; Path: `components/ui/tooltip.tsx`

### Toast
- Success/error/info; stack bottom; action optional
- Path: store + `components/ui/toaster.tsx`

### Switch / Checkbox / Radio / Slider
- Settings toggles; privacy radios; text size slider

### Progress
- Upload/download bars; determinate

### Popover / EmojiPanel
- Emoji/sticker/GIF panels anchored to composer

### Command / Combobox
- User picker; command palette Ctrl+K; country picker

### ScrollArea
- Chat list; emoji panel

### Skeleton
- Chat rows; message list; profile header

### EmptyState
- Illustration slot + title + description + CTA

### Spinner / ConnectionBanner
- Shell connection states

### MessageBubble (+ variants)
- Feature component not primitive — `components/chat/message-bubble.tsx`

### ChatListItem
- `components/chat/chat-list-item.tsx`

### Composer
- `components/chat/composer.tsx`

### MediaViewer
- Portal overlay component

### PresenceDot / TypingDots / Checks
- Indicators with aria labels

### VirtualList
- Wrapper around virtualizer for chat list & messages

---

## States Every Interactive Component Must Support

default · hover · focus-visible · active · disabled · loading · error (if input)

## Keyboard

Follow Radix patterns; document exceptions in feature docs.

## Do / Don’t
- Don’t invent one-off buttons with divergent radius.
- Don’t use multi-layer neon shadows.
- Do reuse Avatar everywhere (list, header, profile).

---

*End of 20-ui-components.md*
