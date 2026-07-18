import { ExternalLink } from 'lucide-react'
import { extractUrls, getLinkMeta } from '@/lib/link-utils'
import { cn } from '@/lib/utils'

interface LinkPreviewProps {
  content: string
  isOwn?: boolean
}

export function LinkPreview({ content, isOwn }: LinkPreviewProps) {
  const url = extractUrls(content)[0]
  if (!url) return null
  const meta = getLinkMeta(url)
  if (!meta) return null

  return (
    <a
      href={meta.href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'mt-2 flex items-start gap-3 overflow-hidden rounded-xl border px-3 py-2.5 transition-colors',
        isOwn
          ? 'border-black/10 bg-black/5 hover:bg-black/8'
          : 'border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)]',
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <img
        src={meta.favicon}
        alt=""
        className="mt-0.5 h-8 w-8 rounded-lg bg-white object-contain p-1"
        loading="lazy"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-[var(--accent)]">{meta.host}</p>
        <p className="truncate text-sm text-[var(--text-primary)]">
          {meta.path || meta.host}
        </p>
      </div>
      <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
    </a>
  )
}

