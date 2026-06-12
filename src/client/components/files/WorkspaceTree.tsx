import { useTranslation } from 'react-i18next'
import { ChevronRight, Folder, FolderOpen, RefreshCw, Link2 } from 'lucide-react'
import { cn } from '@/client/lib/utils'
import { Skeleton } from '@/client/components/ui/skeleton'
import { ScrollArea } from '@/client/components/ui/scroll-area'
import { getFileIcon } from '@/client/lib/file-icons'
import type { WorkspaceEntry } from '@/shared/types'
import type { WorkspaceDirState } from '@/client/hooks/useWorkspaceFiles'

interface WorkspaceTreeProps {
  dirs: Record<string, WorkspaceDirState>
  expanded: Set<string>
  selectedPath: string | null
  onToggleDir: (path: string) => void
  onSelectFile: (entry: WorkspaceEntry) => void
  onSelectDir?: (entry: WorkspaceEntry) => void
  onRetryDir: (path: string) => void
}

/** Indentation is capped so deep nodes stay readable at w-64 (files.md § 3.1). */
const indentFor = (depth: number) => Math.min(depth, 8) * 12

export function WorkspaceTree({
  dirs,
  expanded,
  selectedPath,
  onToggleDir,
  onSelectFile,
  onSelectDir,
  onRetryDir,
}: WorkspaceTreeProps) {
  const { t } = useTranslation()

  function renderDir(path: string, depth: number) {
    const state = dirs[path]
    if (!state || (state.isLoading && state.entries === null)) {
      return (
        <div className="space-y-1 py-1" style={{ paddingLeft: indentFor(depth) + 8 }}>
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      )
    }
    if (state.error && state.entries === null) {
      return (
        <button
          type="button"
          onClick={() => onRetryDir(path)}
          className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-xs text-destructive hover:bg-muted"
          style={{ paddingLeft: indentFor(depth) + 8 }}
          title={state.error}
        >
          <RefreshCw className="size-3 shrink-0" />
          <span className="truncate">{t('files.tree.loadError')}</span>
        </button>
      )
    }
    const entries = state.entries ?? []
    if (entries.length === 0 && path !== '') {
      return (
        <div
          className="px-2 py-1 text-xs italic text-muted-foreground"
          style={{ paddingLeft: indentFor(depth) + 8 }}
        >
          {t('files.tree.emptyFolder')}
        </div>
      )
    }
    return entries.map((entry) => renderEntry(entry, depth))
  }

  function renderEntry(entry: WorkspaceEntry, depth: number) {
    const isDir = entry.type === 'dir'
    const isExpanded = isDir && expanded.has(entry.path)
    const isSelected = selectedPath === entry.path
    const FileIcon = isDir ? (isExpanded ? FolderOpen : Folder) : getFileIcon(entry.name)

    return (
      <div key={entry.path}>
        <button
          type="button"
          onClick={() => {
            if (isDir) {
              onToggleDir(entry.path)
              onSelectDir?.(entry)
            } else {
              onSelectFile(entry)
            }
          }}
          title={entry.path}
          aria-current={isSelected ? 'true' : undefined}
          className={cn(
            'group flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors',
            isSelected ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
          )}
          style={{ paddingLeft: indentFor(depth) + 8 }}
        >
          {isDir ? (
            <ChevronRight
              className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', isExpanded && 'rotate-90')}
            />
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <FileIcon className={cn('size-4 shrink-0', isDir ? 'text-primary/70' : 'text-muted-foreground')} />
          <span className="min-w-0 flex-1 truncate">{entry.name}</span>
          {entry.isSymlink && <Link2 className="size-3 shrink-0 text-muted-foreground" aria-label="symlink" />}
        </button>
        {isDir && isExpanded && <div>{renderDir(entry.path, depth + 1)}</div>}
      </div>
    )
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="p-1.5">{renderDir('', 0)}</div>
    </ScrollArea>
  )
}
