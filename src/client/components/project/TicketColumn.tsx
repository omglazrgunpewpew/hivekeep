import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { TicketCard } from './TicketCard'
import { cn } from '@/client/lib/utils'
import type { TicketStatus, TicketSummary } from '@/shared/types'

interface TicketColumnProps {
  status: TicketStatus
  label: string
  tickets: TicketSummary[]
  onTicketClick: (ticket: TicketSummary) => void
}

/**
 * Per-status visual accent. We use semantic design tokens (success / warning /
 * destructive / info / primary) so the column accent stays consistent across
 * palettes and themes. The accent is intentionally subtle — a dot + a 1px
 * top border on the drop zone — to convey state at a glance without competing
 * with the ticket cards themselves.
 */
const STATUS_ACCENT: Record<TicketStatus, { dot: string; border: string; badge: string }> = {
  backlog: {
    dot: 'bg-muted-foreground/60',
    border: 'border-muted-foreground/30',
    badge: 'text-muted-foreground',
  },
  todo: {
    dot: 'bg-info',
    border: 'border-info/40',
    badge: 'text-info',
  },
  in_progress: {
    dot: 'bg-primary',
    border: 'border-primary/50',
    badge: 'text-primary',
  },
  blocked: {
    dot: 'bg-destructive',
    border: 'border-destructive/50',
    badge: 'text-destructive',
  },
  done: {
    dot: 'bg-success',
    border: 'border-success/50',
    badge: 'text-success',
  },
}

export function TicketColumn({ status, label, tickets, onTicketClick }: TicketColumnProps) {
  // Column-level droppable so empty columns still accept drops
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${status}`,
    data: { type: 'column', status },
  })

  const accent = STATUS_ACCENT[status]

  return (
    <div className="flex h-full w-72 shrink-0 flex-col">
      <header className="mb-2 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span className={cn('size-2 rounded-full', accent.dot)} aria-hidden />
          {label}
        </h2>
        <span className={cn('text-xs tabular-nums', accent.badge)}>{tickets.length}</span>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 space-y-2 overflow-y-auto rounded-lg border-t-2 border-2 border-dashed border-transparent p-1 transition-colors',
          // Subtle accent strip on the top of the drop zone, palette-aware.
          accent.border,
          'border-l-transparent border-r-transparent border-b-transparent',
          isOver && 'border-primary/40 bg-primary/5',
        )}
      >
        <SortableContext items={tickets.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onClick={() => onTicketClick(ticket)}
            />
          ))}
        </SortableContext>
        {tickets.length === 0 && (
          <p className="px-2 pt-4 text-center text-xs text-muted-foreground/60">
            No tickets
          </p>
        )}
      </div>
    </div>
  )
}
