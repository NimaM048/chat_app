import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function SettingsPageShell({
  title,
  children,
  backTo = '/app/settings',
  action,
}: {
  title: string
  children: ReactNode
  backTo?: string
  action?: ReactNode
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--surface-2)]">
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-[var(--border)] bg-[var(--sidebar-bg)] px-2">
        <Link
          to={backTo}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--accent)] hover:bg-[var(--chat-hover)]"
          aria-label="Back"
        >
          <ChevronRight className="h-6 w-6 rotate-180" />
        </Link>
        <h1 className="flex-1 truncate text-[17px] font-medium text-[var(--text-primary)]">
          {title}
        </h1>
        {action}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}

export function SettingsSection({
  title,
  children,
  footer,
}: {
  title?: string
  children: ReactNode
  footer?: string
}) {
  return (
    <section className="mb-3">
      {title ? (
        <p className="px-4 pt-4 pb-1.5 text-[13px] font-medium text-[var(--accent)]">
          {title}
        </p>
      ) : (
        <div className="h-3" />
      )}
      <div className="mx-0 overflow-hidden rounded-xl bg-[var(--sidebar-bg)] md:mx-0">
        {children}
      </div>
      {footer ? (
        <p className="px-4 pt-2 text-[13px] leading-snug text-[var(--text-muted)]">
          {footer}
        </p>
      ) : null}
    </section>
  )
}

export function SettingsIconBubble({
  icon: Icon,
  color,
  className,
}: {
  icon: LucideIcon
  color: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-white',
        className,
      )}
      style={{ background: color }}
    >
      <Icon className="h-4 w-4" strokeWidth={2.25} />
    </span>
  )
}

export function SettingsNavRow({
  to,
  icon,
  color,
  label,
  value,
  danger,
}: {
  to: string
  icon: LucideIcon
  color: string
  label: string
  value?: string
  danger?: boolean
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-[11px] last:border-b-0 hover:bg-[var(--chat-hover)]"
    >
      <SettingsIconBubble icon={icon} color={color} />
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-[16px]',
          danger ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]',
        )}
      >
        {label}
      </span>
      {value ? (
        <span className="max-w-[40%] truncate text-[15px] text-[var(--text-muted)]">
          {value}
        </span>
      ) : null}
      <ChevronRight className="h-5 w-5 shrink-0 text-[var(--text-muted)] opacity-60" />
    </Link>
  )
}

export function SettingsSwitchRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 border-b border-[var(--border)] px-4 py-3 text-left last:border-b-0 hover:bg-[var(--chat-hover)]"
      onClick={() => onChange(!checked)}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[16px] text-[var(--text-primary)]">{label}</p>
        {description ? (
          <p className="mt-0.5 text-[13px] leading-snug text-[var(--text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      <span
        className={cn(
          'relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors',
          checked ? 'bg-[var(--accent)]' : 'bg-[var(--surface-3)]',
        )}
        aria-hidden
      >
        <span
          className={cn(
            'absolute top-[2px] h-[22px] w-[22px] rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-[2px]',
          )}
        />
      </span>
    </button>
  )
}

export function SettingsRadioRow({
  label,
  selected,
  onSelect,
}: {
  label: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 border-b border-[var(--border)] px-4 py-3 text-left last:border-b-0 hover:bg-[var(--chat-hover)]"
    >
      <span className="min-w-0 flex-1 text-[16px] text-[var(--text-primary)]">
        {label}
      </span>
      <span
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-full border-2',
          selected
            ? 'border-[var(--accent)]'
            : 'border-[var(--text-muted)]',
        )}
      >
        {selected ? (
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
        ) : null}
      </span>
    </button>
  )
}

export function SettingsActionRow({
  label,
  description,
  onClick,
  danger,
  value,
}: {
  label: string
  description?: string
  onClick?: () => void
  danger?: boolean
  value?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-[var(--border)] px-4 py-3 text-left last:border-b-0 hover:bg-[var(--chat-hover)]"
    >
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-[16px]',
            danger ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]',
          )}
        >
          {label}
        </p>
        {description ? (
          <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {value ? (
        <span className="text-[15px] text-[var(--text-muted)]">{value}</span>
      ) : null}
      {onClick ? (
        <ChevronRight className="h-5 w-5 shrink-0 text-[var(--text-muted)] opacity-60" />
      ) : null}
    </button>
  )
}
