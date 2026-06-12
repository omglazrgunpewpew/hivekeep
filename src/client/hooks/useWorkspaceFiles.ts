import { useState, useEffect, useCallback, useRef } from 'react'
import { api, getErrorMessage } from '@/client/lib/api'
import { useSSEResync } from '@/client/hooks/useSSE'
import type { WorkspaceEntry } from '@/shared/types'

/** Loading state of one lazily-fetched directory of the workspace tree. */
export interface WorkspaceDirState {
  entries: WorkspaceEntry[] | null
  isLoading: boolean
  error: string | null
}

interface LsResponse {
  path: string
  entries: WorkspaceEntry[]
}

/**
 * Workspace tree state for the Files section (files.md § 3.3): directories are
 * fetched lazily on expansion, refetched on resume (SSE has no replay), and
 * patched live by `workspace:changed` (wired in P5).
 */
export function useWorkspaceFiles(agentId: string | null) {
  // Keyed by dir path ('' = workspace root).
  const [dirs, setDirs] = useState<Record<string, WorkspaceDirState>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // Guards against out-of-order responses after rapid agent switches.
  const generationRef = useRef(0)

  const loadDir = useCallback(
    async (path: string) => {
      if (!agentId) return
      const generation = generationRef.current
      setDirs((prev) => ({
        ...prev,
        [path]: { entries: prev[path]?.entries ?? null, isLoading: true, error: null },
      }))
      try {
        const data = await api.get<LsResponse>(
          `/agents/${encodeURIComponent(agentId)}/workspace/ls?path=${encodeURIComponent(path)}`,
        )
        if (generation !== generationRef.current) return
        setDirs((prev) => ({ ...prev, [path]: { entries: data.entries, isLoading: false, error: null } }))
      } catch (err) {
        if (generation !== generationRef.current) return
        setDirs((prev) => ({
          ...prev,
          [path]: { entries: prev[path]?.entries ?? null, isLoading: false, error: getErrorMessage(err) },
        }))
      }
    },
    [agentId],
  )

  const toggleDir = useCallback(
    (path: string) => {
      setExpanded((prev) => {
        const next = new Set(prev)
        if (next.has(path)) {
          next.delete(path)
        } else {
          next.add(path)
          // (Re)fetch on every expansion: shell-driven agent writes emit no SSE,
          // so expansion is one of the freshness fallbacks (files.md § 8.1).
          void loadDir(path)
        }
        return next
      })
    },
    [loadDir],
  )

  /** Expand every ancestor directory of `path` (deep links, reveal-in-tree). */
  const expandTo = useCallback(
    (path: string) => {
      const parts = path.split('/').filter(Boolean)
      const ancestors: string[] = []
      for (let i = 0; i < parts.length - 1; i++) ancestors.push(parts.slice(0, i + 1).join('/'))
      setExpanded((prev) => {
        const next = new Set(prev)
        for (const dir of ancestors) next.add(dir)
        return next
      })
      for (const dir of ancestors) void loadDir(dir)
    },
    [loadDir],
  )

  /** Refetch the root and every expanded directory (refresh button / resume). */
  const refresh = useCallback(() => {
    if (!agentId) return
    void loadDir('')
    for (const dir of expanded) void loadDir(dir)
  }, [agentId, loadDir, expanded])

  // Reset and reload when switching workspaces.
  useEffect(() => {
    generationRef.current++
    setDirs({})
    setExpanded(new Set())
    if (agentId) void loadDir('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId])

  // SSE has no event replay: refetch visible state on tab resume / reconnect.
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  useSSEResync(() => refreshRef.current())

  return { dirs, expanded, loadDir, toggleDir, expandTo, refresh, setDirs }
}
