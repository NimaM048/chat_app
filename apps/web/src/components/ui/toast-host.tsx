import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { useToastStore } from '@/stores/toast-store'
import { useChatUiStore } from '@/stores/chat-ui-store'

export function ToastHost() {
  const toasts = useToastStore((state) => state.toasts)
  const dismissToast = useToastStore((state) => state.dismissToast)
  const setActiveConversationId = useChatUiStore(
    (state) => state.setActiveConversationId,
  )

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3 md:inset-x-auto md:right-4 md:items-end">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            title={toast.title}
            body={toast.body}
            onOpen={() => {
              if (toast.conversationId) {
                setActiveConversationId(toast.conversationId)
              }
              dismissToast(toast.id)
            }}
            onDismiss={() => dismissToast(toast.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ToastItem({
  title,
  body,
  onOpen,
  onDismiss,
}: {
  title: string
  body: string
  onOpen: () => void
  onDismiss: () => void
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 4500)
    return () => window.clearTimeout(timer)
  }, [onDismiss])

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="pointer-events-auto w-full max-w-[360px] rounded-xl bg-[var(--surface-1)] px-3.5 py-2.5 text-left shadow-[0_4px_16px_rgba(0,0,0,0.18)] md:w-[320px]"
      onClick={onOpen}
    >
      <p className="truncate text-[14px] font-medium text-[var(--text-primary)]">
        {title}
      </p>
      <p className="mt-0.5 line-clamp-2 text-[13px] text-[var(--text-secondary)]">
        {body}
      </p>
    </motion.button>
  )
}
