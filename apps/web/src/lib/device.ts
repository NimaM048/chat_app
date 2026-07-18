const DEVICE_ID_KEY = 'chat-device-id'

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') {
    return 'server'
  }

  const existing = localStorage.getItem(DEVICE_ID_KEY)
  if (existing) {
    return existing
  }

  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`

  localStorage.setItem(DEVICE_ID_KEY, id)
  return id
}

export function getDeviceMeta() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
  let deviceName = 'Web browser'
  if (/Edg\//.test(ua)) deviceName = 'Edge on Web'
  else if (/Chrome\//.test(ua)) deviceName = 'Chrome on Web'
  else if (/Firefox\//.test(ua)) deviceName = 'Firefox on Web'
  else if (/Safari\//.test(ua)) deviceName = 'Safari on Web'

  if (/Windows/i.test(ua)) deviceName = deviceName.replace('Web', 'Windows')
  else if (/Mac OS/i.test(ua)) deviceName = deviceName.replace('Web', 'macOS')
  else if (/Android/i.test(ua)) deviceName = deviceName.replace('Web', 'Android')
  else if (/iPhone|iPad/i.test(ua)) deviceName = deviceName.replace('Web', 'iOS')

  return {
    deviceId: getOrCreateDeviceId(),
    deviceName,
    platform: 'web' as const,
  }
}

/** Mute "forever" — far-future ISO used by Telegram-like UIs */
export const MUTE_FOREVER_ISO = '2099-01-01T00:00:00.000Z'

export function muteUntilFromPreset(
  preset: '1h' | '8h' | '1d' | '7d' | 'forever',
): string {
  if (preset === 'forever') return MUTE_FOREVER_ISO
  const hours =
    preset === '1h' ? 1 : preset === '8h' ? 8 : preset === '1d' ? 24 : 24 * 7
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}
