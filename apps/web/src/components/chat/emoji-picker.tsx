const EMOJIS = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎',
  '🤩', '🤗', '🤔', '😅', '😭', '😤', '😴', '🤯',
  '👍', '👎', '👏', '🙌', '🔥', '✨', '💯', '❤️',
  '💙', '💜', '💚', '🧡', '🤝', '👀', '🎉', '✅',
]

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
}

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  return (
    <div className="absolute bottom-14 left-0 z-30 grid w-64 grid-cols-8 gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-2 shadow-[var(--shadow-soft)]">
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="rounded-lg p-1 text-lg transition hover:bg-[var(--surface-2)]"
          onClick={() => onSelect(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
