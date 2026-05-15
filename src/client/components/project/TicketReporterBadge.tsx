import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/client/components/ui/tooltip'
import { Bot, User } from 'lucide-react'
import { cn } from '@/client/lib/utils'
import type { TicketReporter } from '@/shared/types'

interface TicketReporterBadgeProps {
  reporter: TicketReporter | null
  /** "compact" → avatar-only with tooltip. "full" → avatar + name inline. */
  variant?: 'compact' | 'full'
  /** Avatar size class. Defaults: compact size-4, full size-5. */
  size?: string
  className?: string
  /** When true and reporter is a Kin with a slug, the avatar links to that Kin's thread. */
  clickable?: boolean
}

/**
 * Discreet badge showing who created the ticket — either a platform user
 * (via UI) or a Kin (via tool call). Designed to be small and unobtrusive on
 * the kanban card and inline within the side panel header.
 */
export function TicketReporterBadge({
  reporter,
  variant = 'compact',
  size,
  className,
  clickable = true,
}: TicketReporterBadgeProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  if (!reporter) return null

  const initials = reporter.name.slice(0, 2).toUpperCase()
  const isKin = reporter.type === 'kin'
  const TypeIcon = isKin ? Bot : User
  const avatarSize = size ?? (variant === 'compact' ? 'size-4' : 'size-5')

  const handleClick = (e: React.MouseEvent) => {
    if (!clickable) return
    if (isKin && reporter.slug) {
      e.stopPropagation()
      navigate(`/kin/${reporter.slug}`)
    }
  }

  const isClickable = clickable && isKin && reporter.slug

  const avatarEl = (
    <Avatar className={cn(avatarSize, 'ring-1 ring-background')}>
      {reporter.avatarUrl && <AvatarImage src={reporter.avatarUrl} alt={reporter.name} />}
      <AvatarFallback className="text-[9px] bg-secondary">{initials}</AvatarFallback>
    </Avatar>
  )

  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5',
        variant === 'compact' && 'shrink-0',
        isClickable && 'cursor-pointer hover:opacity-80',
        className,
      )}
      onClick={handleClick}
    >
      {avatarEl}
      {variant === 'full' && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <TypeIcon className="size-3 shrink-0" />
          <span className="truncate">{reporter.name}</span>
        </span>
      )}
    </span>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {variant === 'compact' ? (
          <button type="button" className="inline-flex" onClick={handleClick} aria-label={t('projects.reporter.tooltip', { name: reporter.name })}>
            {content}
          </button>
        ) : (
          content
        )}
      </TooltipTrigger>
      <TooltipContent side="top">
        <span className="text-xs">
          {t(isKin ? 'projects.reporter.byKin' : 'projects.reporter.byUser', { name: reporter.name })}
        </span>
      </TooltipContent>
    </Tooltip>
  )
}
