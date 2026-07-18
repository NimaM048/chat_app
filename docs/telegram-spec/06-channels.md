# 06 — Channels

> **MVP Status:** ⛔ Not implemented. `ConversationType` needs `CHANNEL`. This doc is the full target product spec.

---

## 1. Purpose

Channels are **one-to-many broadcast** surfaces: admins post; subscribers receive. Ideal for announcements, news, creators. Unlike groups, the default member cannot write.

**Why Telegram:** Unlimited-scale broadcast with familiar chat UX; comments via linked discussion group.  
**Pros:** Clean publishing; analytics; username discovery.  
**Cons:** Weaker back-and-forth (by design); moderation of comments offloaded to discussion group.  
**Improvements for us:** Simpler admin onboarding; built-in scheduled posts first-class.

---

## 2. Creation

### Flow
1. Compose → New channel.
2. Name + description + avatar.
3. Public (username) vs Private (invite).
4. Create → owner opens channel; empty state “Channel created”.

### API
```http
POST /api/v1/channels
{ "title": "Product Updates", "description": "...", "isPublic": false, "username": null }
```

### DB
`Conversation.type = CHANNEL`; creator OWNER; `subscriberCount` denormalized.

---

## 3. Roles

| Role | Can post | Can edit others | Manage channel |
|------|----------|-----------------|----------------|
| OWNER | ✅ | ✅ | ✅ |
| ADMIN | if `canPost` | if `canEditMessages` | per flags |
| SUBSCRIBER | ❌ | ❌ | ❌ |

Anonymous admin: posts show channel name instead of admin identity (`canAnonymous` / per-post toggle).

---

## 4. UI — Subscriber View

- Header: channel title + subscribers count.
- Composer hidden → “You joined this channel” / mute / leave actions bar OR nothing (read-only timeline).
- Posts look like messages; views counter on each post (Telegram-style eye count).

### Admin View
- Composer enabled.
- Stats entry in info.
- Post options: silent, schedule, pin, discuss.

---

## 5. Discussion Group (Comments)

### Purpose
Attach a GROUP as comments thread for posts.

### Behavior
- Link/create discussion group in channel settings.
- “Comment” on post opens/creates thread message in discussion group (product simplification: open discussion group with reply context).
- **Phase target:** `Message.discussionMessageId` linkage.

### API
```http
POST /api/v1/channels/:id/discussion { "groupId": "..." } | { "create": true }
DELETE /api/v1/channels/:id/discussion
```

---

## 6. Public vs Private / Usernames

Same username rules as public groups. Public channels appear in global search. Private: invite links only.

Join requests supported for private channels with approval links.

---

## 7. Invite Links

Same subsystem as groups (`InviteLink` with `conversationId`), labeled Channel invite links in UI.

---

## 8. Posts — Product Rules

- Edit/delete with admin rights; “edited” badge.
- Pin up to N posts.
- Forward from channel keeps attribution (“Forwarded from Channel”).
- Views: increment uniquely per user/session with Redis HyperLogLog or `PostView(userId, messageId)` sampled — start with approximate Redis SET daily.

### Scheduled posts
`scheduledFor` + BullMQ job; appear in “Scheduled” folder for admins.

### Silent posts
No push notification; still unread increment optional (Telegram silent = no notification).

---

## 9. Stats (Product Behavior)

Telegram shows growth, views per post, followers. **Our phased stats:**
- Phase A: per-post view count + subscriber count.
- Phase B: 7/30-day joins/leaves, top posts.
- Store daily aggregates table `ChannelDailyStat`.

UI: Channel info → Statistics (admins only).

---

## 10. Subscriber Management

- List recent subscribers (privacy: Telegram limits visibility — show admins only or approximate).
- Remove / ban subscriber.
- Promote admins.

---

## 11. Notifications

- Default: notify each post.
- Mute channel like any chat.
- Mentions rare in channels unless comments.

---

## 12. Boosts / Premium (Telegram)

Documented for parity awareness: **⛔ Deferred / out of monetization scope** unless product later adds “boosts”. Do not block channel MVP.

---

## 13. Realtime Events

| Event | Notes |
|-------|-------|
| `channel:post_new` | alias of `message:new` with type CHANNEL |
| `channel:updated` | title, photo, username |
| `channel:subscriber_count` | throttled updates |
| `message:views` | optional live view bumps |

---

## 14. Permissions / Validation / A11y / Platforms

- Enforce post rights server-side always.
- Title 1–128; description ≤255; username unique global among users/groups/channels.
- Screen reader: “Channel, Product Updates, 12 hundred subscribers”.
- Mobile: join via profile; Desktop: info panel manage.

### Animation
- Subscribe button → mute/leave morph 200ms.
- View count subtle tick.

### Loading / Empty / Error
- Empty channel admin CTA “Post your first update”.
- Private invite invalid → error page.

---

## 15. Edge Cases

- Username taken by user → conflict error.
- Admin demoted while composing → fail send gracefully.
- Discussion group deleted → unlink + toast.
- Mass forward rate limits.
- Subscriber leaves then rejoins with history policy.

---

## 16. Testing Checklist

- [ ] Create public/private
- [ ] Subscriber cannot post
- [ ] Admin post + views
- [ ] Invite join
- [ ] Schedule delivery
- [ ] Discussion link
- [ ] Transfer ownership
- [ ] Delete channel

---

*End of 06-channels.md*
