import {
  Mic,
  Paperclip,
  SendHorizontal,
  Smile,
  Square,
  X,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { EmojiPicker } from '@/components/chat/emoji-picker'
import { Button } from '@/components/ui/button'
import { usePreferencesStore } from '@/stores/preferences-store'
import type { ChatMessage } from '@/types/chat'
interface MessageComposerProps {
  conversationId: string
  disabled?: boolean
  replyTo: ChatMessage | null
  editing: ChatMessage | null
  draft: string
  onDraftChange: (value: string) => void
  onCancelReply: () => void
  onCancelEdit: () => void
  onSend: (content: string) => Promise<void> | void
  onEdit: (content: string) => Promise<void> | void
  onSendFile: (file: File) => Promise<void> | void
  onSendVoice: (blob: Blob, durationMs: number) => Promise<void> | void
  onTypingStart: () => void
  onTypingStop: () => void
}
export function MessageComposer({
  conversationId,
  disabled,
  replyTo,
  editing,
  draft,
  onDraftChange,
  onCancelReply,
  onCancelEdit,
  onSend,
  onEdit,
  onSendFile,
  onSendVoice,
  onTypingStart,
  onTypingStop,
}: MessageComposerProps) {
  const [value, setValue] = useState(draft)
  const [sending, setSending] = useState(false)
  const [sendPulse, setSendPulse] = useState(0)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordMs, setRecordMs] = useState(0)
  const typingTimeout = useRef<number | null>(null)
  const isTyping = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const startedAtRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }, [])
  useEffect(() => {
    if (editing) return
    setValue(draft)
    requestAnimationFrame(resizeTextarea)
  }, [conversationId, draft, editing, resizeTextarea])
  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0]
      if (!file || sending || disabled || editing) return
      setSending(true)
      try {
        await onSendFile(file)
      } finally {
        setSending(false)
      }
    },
    [disabled, editing, onSendFile, sending],
  )
  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    multiple: false,
    disabled: disabled || sending || recording || Boolean(editing),
  })
  useEffect(() => {
    return () => {
      if (typingTimeout.current) window.clearTimeout(typingTimeout.current)
      if (timerRef.current) window.clearInterval(timerRef.current)
      if (isTyping.current) onTypingStop()
      mediaRecorderRef.current?.stop()
    }
  }, [onTypingStop])
  useEffect(() => {
    if (editing) {
      setValue(editing.content)
      textareaRef.current?.focus()
      requestAnimationFrame(resizeTextarea)
      return
    }
    if (replyTo) textareaRef.current?.focus()
  }, [editing, replyTo, resizeTextarea])
  useEffect(() => {
    resizeTextarea()
  }, [value, resizeTextarea])
  function updateValue(next: string) {
    setValue(next)
    if (!editing) onDraftChange(next)
  }
  async function handleSend() {
    const content = value.trim()
    if (!content || sending || disabled) return
    setSending(true)
    setSendPulse((n) => n + 1)
    updateValue('')
    setEmojiOpen(false)
    if (isTyping.current) {
      isTyping.current = false
      onTypingStop()
    }
    try {
      if (editing) {
        await onEdit(content)
      } else {
        await onSend(content)
      }
    } finally {
      setSending(false)
      textareaRef.current?.focus()
      requestAnimationFrame(resizeTextarea)
    }
  }
  async function startRecording() {
    if (recording || sending || disabled || editing) return
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream)
    chunksRef.current = []
    startedAtRef.current = Date.now()
    setRecordMs(0)
    timerRef.current = window.setInterval(() => {
      setRecordMs(Date.now() - startedAtRef.current)
    }, 200)
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop())
      if (timerRef.current) window.clearInterval(timerRef.current)
      const durationMs = Date.now() - startedAtRef.current
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      setRecording(false)
      setSending(true)
      try {
        await onSendVoice(blob, durationMs)
      } finally {
        setSending(false)
      }
    }
    mediaRecorderRef.current = recorder
    recorder.start()
    setRecording(true)
  }
  function stopRecording() {
    mediaRecorderRef.current?.stop()
  }
  return (
    <div
      {...getRootProps()}
      className={`border-t border-[var(--border)] bg-[var(--sidebar-bg)] px-2 py-1.5 transition-colors ${
        isDragActive ? 'bg-[var(--accent-soft)]' : ''
      }`}
    >
      <input {...getInputProps()} />
      {editing ? (
        <div className="mx-auto mb-2 flex max-w-3xl items-center gap-2 rounded-xl bg-[var(--accent-soft)] px-3 py-2">
          <div className="min-w-0 flex-1 border-l-2 border-[var(--accent)] pl-2">
            <p className="text-xs font-semibold text-[var(--accent)]">Edit message</p>
            <p className="truncate text-xs text-[var(--text-secondary)]">{editing.content}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              updateValue(draft)
              onCancelEdit()
            }}
            aria-label="Cancel edit"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
      {replyTo && !editing ? (
        <div className="mx-auto mb-2 flex max-w-3xl items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2">
          <div className="min-w-0 flex-1 border-l-2 border-[var(--accent)] pl-2">
            <p className="text-xs font-semibold text-[var(--accent)]">
              Reply to {replyTo.sender.displayName}
            </p>
            <p className="truncate text-xs text-[var(--text-secondary)]">
              {replyTo.content || replyTo.fileName || 'Media'}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancelReply} aria-label="Cancel reply">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
      {recording ? (
        <div className="mx-auto mb-2 flex max-w-3xl items-center gap-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          Recording… {(recordMs / 1000).toFixed(1)}s
        </div>
      ) : null}
      <div className="relative mx-auto flex max-w-3xl items-end gap-1.5">
        {emojiOpen ? (
          <EmojiPicker
            onSelect={(emoji) => {
              updateValue(`${value}${emoji}`)
              textareaRef.current?.focus()
            }}
          />
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          type="button"
          aria-label="Emoji"
          onClick={() => setEmojiOpen((open) => !open)}
          disabled={recording}
        >
          <Smile className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          aria-label="Attach file"
          onClick={open}
          disabled={recording || sending || Boolean(editing)}
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        <textarea
          ref={textareaRef}
          value={value}
          disabled={disabled || sending || recording}
          rows={1}
          placeholder={
            editing
              ? 'Edit message…'
              : isDragActive
                ? 'Drop file to send…'
                : 'Message'
          }
          className="tg-composer-input max-h-32 min-h-[42px] flex-1 resize-none overflow-y-auto rounded-[21px] px-4 py-2.5 text-[15px] leading-5 text-[var(--text-primary)]"
          onChange={(event) => {
            updateValue(event.target.value)
            if (editing) return
            if (!isTyping.current) {
              isTyping.current = true
              onTypingStart()
            }
            if (typingTimeout.current) window.clearTimeout(typingTimeout.current)
            typingTimeout.current = window.setTimeout(() => {
              isTyping.current = false
              onTypingStop()
            }, 1200)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && editing) {
              event.preventDefault()
              updateValue(draft)
              onCancelEdit()
              return
            }
            if (event.key === 'Enter' && !event.shiftKey) {
              const sendOnEnter =
                usePreferencesStore.getState().preferences.sendOnEnter
              if (!sendOnEnter) return
              event.preventDefault()
              void handleSend()
            }
          }}
        />
        {value.trim() || editing ? (
          <motion.div
            key={sendPulse}
            initial={{ scale: 0.85 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 18 }}
          >
            <Button
              size="icon"
              type="button"
              disabled={disabled || sending || !value.trim()}
              onClick={() => void handleSend()}
              aria-label={editing ? 'Save edit' : 'Send message'}
              className="rounded-full"
            >
              <motion.span
                animate={sending ? { rotate: 12, x: 2 } : { rotate: 0, x: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 16 }}
              >
                <SendHorizontal className="h-5 w-5" />
              </motion.span>
            </Button>
          </motion.div>
        ) : (
          <Button
            size="icon"
            type="button"
            variant={recording ? 'default' : 'ghost'}
            disabled={disabled || sending}
            onClick={() => (recording ? stopRecording() : void startRecording())}
            aria-label={recording ? 'Stop recording' : 'Record voice'}
          >
            {recording ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
          </Button>
        )}
      </div>
    </div>
  )
}
