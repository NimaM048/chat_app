import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff } from 'lucide-react'
import { useChatUiStore } from '@/stores/chat-ui-store'

export function ConnectionBanner() {
  const connectionState = useChatUiStore((state) => state.connectionState)
  const visible = connectionState !== 'connected'
  const label =
    connectionState === 'connecting'
      ? 'Connecting…'
      : 'Waiting for network…'

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-center gap-2 bg-[#232e3c] px-3 py-1.5 text-xs font-medium text-white">
            <WifiOff className="h-3.5 w-3.5 opacity-80" />
            {label}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
