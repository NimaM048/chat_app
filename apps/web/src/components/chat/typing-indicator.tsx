import { motion } from 'framer-motion'

export function TypingIndicator({ name }: { name?: string | null }) {
  if (!name) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 2 }}
      className="flex items-center gap-1.5 text-[13px] text-[var(--accent)]"
    >
      <span className="truncate font-medium">
        {name}
        <span className="font-normal"> is typing</span>
      </span>
      <span className="typing-dots inline-flex gap-0.5">
        <span className="h-1 w-1 rounded-full bg-current" />
        <span className="h-1 w-1 rounded-full bg-current" />
        <span className="h-1 w-1 rounded-full bg-current" />
      </span>
    </motion.div>
  )
}
