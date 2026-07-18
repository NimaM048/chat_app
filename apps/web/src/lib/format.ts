/** Telegram-style relative timestamps for chat list / last seen. */

export function formatChatListTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startMsg = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayDiff = Math.round(
    (startToday.getTime() - startMsg.getTime()) / 86_400_000,
  )

  if (dayDiff === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (dayDiff === 1) return 'Yesterday'
  if (dayDiff < 7) {
    return date.toLocaleDateString([], { weekday: 'short' })
  }
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

export function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return 'last seen recently'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'last seen recently'

  const now = Date.now()
  const diffMs = now - date.getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'last seen just now'
  if (mins < 60) return `last seen ${mins} min ago`

  const hours = Math.floor(mins / 60)
  if (hours < 24) {
    return `last seen at ${date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`
  }

  const dayDiff = Math.floor(diffMs / 86_400_000)
  if (dayDiff === 1) {
    return `last seen yesterday at ${date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`
  }

  return `last seen ${date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
  })}`
}
