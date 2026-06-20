import { useState } from 'react'
import { X } from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/client/lib/utils'
import { ScrollArea, ScrollBar } from '@/client/components/ui/scroll-area'
import { getFileIcon } from '@/client/lib/file-icons'

interface FileTabsProps {
  /** Open tab paths, in order. */
  tabs: string[]
  active: string | null
  dirtyPaths: Set<string>
  onSelect: (path: string) => void
  onClose: (path: string) => void
  /** Drag-reorder (no-op when omitted). */
  onReorder?: (activeId: string, overId: string) => void
}

const nameOf = (path: string) => path.split('/').pop() ?? path

/** Pointer-fine only: on touch, dragging tabs would hijack the horizontal scroll. */
const finePointer = () => typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches

interface TabProps {
  path: string
  isActive: boolean
  isDirty: boolean
  dndEnabled: boolean
  onSelect: (path: string) => void
  onClose: (path: string) => void
}

function SortableTab({ path, isActive, isDirty, dndEnabled, onSelect, onClose }: TabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: path,
    disabled: !dndEnabled,
  })
  const Icon = getFileIcon(nameOf(path))
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        'group flex max-w-48 shrink-0 cursor-pointer items-center gap-1.5 border-r border-border px-2.5 text-xs transition-colors',
        isActive
          ? 'bg-background text-foreground shadow-[inset_0_-2px_0_var(--color-primary)]'
          : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
        isDragging && 'z-10 opacity-60',
      )}
      role="tab"
      aria-selected={isActive}
      title={path}
      onClick={() => onSelect(path)}
      onAuxClick={(e) => {
        // Middle-click closes (Ctrl/Cmd+W is browser-reserved).
        if (e.button === 1) {
          e.preventDefault()
          onClose(path)
        }
      }}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate">{nameOf(path)}</span>
      {isDirty && <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-label="unsaved" />}
      <button
        type="button"
        className={cn(
          'rounded-sm p-0.5 text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground',
          !isDirty && 'opacity-0 group-hover:opacity-100 max-md:opacity-100',
        )}
        // Stop the drag sensor from swallowing the click on the close target.
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onClose(path)
        }}
        aria-label={`close ${nameOf(path)}`}
      >
        <X className="size-3" />
      </button>
    </div>
  )
}

/**
 * Light editor tabs (files.md § 3.4): dirty dot, close button, middle-click
 * close, horizontally scrollable on narrow screens, drag-to-reorder on fine
 * pointers. All tabs are pinned (no VSCode preview-tab mode in v1).
 */
export function FileTabs({ tabs, active, dirtyPaths, onSelect, onClose, onReorder }: FileTabsProps) {
  const [dndEnabled] = useState(finePointer)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  if (tabs.length === 0) return null

  const handleDragEnd = (e: DragEndEvent) => {
    const overId = e.over?.id
    if (overId && e.active.id !== overId) onReorder?.(String(e.active.id), String(overId))
  }

  return (
    <ScrollArea className="shrink-0 border-b border-border">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tabs} strategy={horizontalListSortingStrategy}>
          <div className="flex h-9 items-stretch">
            {tabs.map((path) => (
              <SortableTab
                key={path}
                path={path}
                isActive={path === active}
                isDirty={dirtyPaths.has(path)}
                dndEnabled={dndEnabled && !!onReorder}
                onSelect={onSelect}
                onClose={onClose}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <ScrollBar orientation="horizontal" className="h-1.5" />
    </ScrollArea>
  )
}
