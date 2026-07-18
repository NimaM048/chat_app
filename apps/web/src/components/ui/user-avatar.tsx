import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials, resolveMediaUrl } from '@/lib/utils'

interface UserAvatarProps {
  name: string
  avatarUrl?: string | null
  className?: string
  fallbackClassName?: string
}

export function UserAvatar({
  name,
  avatarUrl,
  className,
  fallbackClassName,
}: UserAvatarProps) {
  const src = resolveMediaUrl(avatarUrl)

  return (
    <Avatar className={className}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback className={fallbackClassName}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
