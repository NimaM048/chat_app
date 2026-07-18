import { usePreferencesStore } from '@/stores/preferences-store'

let audioCtx: AudioContext | null = null

function beep() {
  try {
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    if (!AudioContextCtor) return
    audioCtx ??= new AudioContextCtor()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.value = 0.04
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + 0.12)
  } catch {
    // ignore autoplay restrictions
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function notifyDesktop(opts: {
  title: string
  body: string
  playSound?: boolean
}) {
  const prefs = usePreferencesStore.getState().preferences
  if (!prefs.desktopNotifications) return

  if (opts.playSound !== false && prefs.soundEnabled) {
    beep()
  }

  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return
  }

  const body = prefs.messagePreview ? opts.body : 'New message'
  try {
    const notification = new Notification(opts.title, {
      body,
      silent: true,
      tag: 'chat-app-message',
    })
    window.setTimeout(() => notification.close(), 5000)
  } catch {
    // ignore
  }
}
