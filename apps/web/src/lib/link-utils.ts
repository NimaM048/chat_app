const URL_REGEX =
  /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX) ?? []
  return [...new Set(matches)]
}

export function getLinkMeta(url: string) {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    const path = `${parsed.pathname}${parsed.search}`.replace(/\/$/, '')
    return {
      host,
      path: path === '/' ? '' : path.slice(0, 64),
      favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`,
      href: url,
    }
  } catch {
    return null
  }
}

export function renderTextWithLinks(text: string) {
  const parts: Array<{ type: 'text' | 'link'; value: string }> = []
  let lastIndex = 0
  const regex = new RegExp(URL_REGEX.source, 'gi')
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'link', value: match[0] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return parts.length ? parts : [{ type: 'text' as const, value: text }]
}
