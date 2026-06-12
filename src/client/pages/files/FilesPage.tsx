import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Folder, FolderTree, RefreshCw, Loader2, FilePlus2 } from 'lucide-react'
import { api, getErrorMessage, ApiRequestError } from '@/client/lib/api'
import { PageHeader } from '@/client/components/layout/PageHeader'
import { EmptyState } from '@/client/components/common/EmptyState'
import { AgentSelector } from '@/client/components/common/AgentSelector'
import { Button } from '@/client/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/client/components/ui/sheet'
import { useAgentList } from '@/client/hooks/useAgentList'
import { useWorkspaceFiles } from '@/client/hooks/useWorkspaceFiles'
import { WorkspaceTree } from '@/client/components/files/WorkspaceTree'
import { WorkspaceEditor } from '@/client/components/files/WorkspaceEditor'
import type { WorkspaceEntry, WorkspaceFileInfo } from '@/shared/types'

const LAST_AGENT_KEY = 'files.lastAgentId'

/**
 * Files section (files.md § 3): VSCode-like browser over agent workspaces.
 * Deep-linkable as /files/:agentId?path=relative/path.
 */
export function FilesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { agentId: routeAgentId } = useParams<{ agentId?: string }>()
  const [searchParams] = useSearchParams()
  const requestedPath = searchParams.get('path')

  const { agents, isLoading: agentsLoading } = useAgentList()

  // Active workspace: route param > localStorage > first agent.
  const storedAgentId = localStorage.getItem(LAST_AGENT_KEY)
  const activeAgentId =
    (routeAgentId && agents.some((a) => a.id === routeAgentId || a.slug === routeAgentId)
      ? (agents.find((a) => a.id === routeAgentId || a.slug === routeAgentId)?.id ?? null)
      : null) ??
    (storedAgentId && agents.some((a) => a.id === storedAgentId) ? storedAgentId : null) ??
    agents[0]?.id ??
    null

  useEffect(() => {
    if (activeAgentId) localStorage.setItem(LAST_AGENT_KEY, activeAgentId)
  }, [activeAgentId])

  const { dirs, expanded, loadDir, toggleDir, expandTo, refresh } = useWorkspaceFiles(activeAgentId)

  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [openFile, setOpenFile] = useState<WorkspaceFileInfo | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [treeSheetOpen, setTreeSheetOpen] = useState(false)

  const openPath = useCallback(
    async (path: string) => {
      if (!activeAgentId) return
      setSelectedPath(path)
      setFileLoading(true)
      setFileError(null)
      try {
        const file = await api.get<WorkspaceFileInfo>(
          `/agents/${encodeURIComponent(activeAgentId)}/workspace/file?path=${encodeURIComponent(path)}`,
        )
        setOpenFile(file)
        expandTo(path)
      } catch (err) {
        if (err instanceof ApiRequestError && err.code === 'IS_DIRECTORY') {
          // Deep link to a folder: expand + select in the tree, no editor tab.
          expandTo(`${path}/x`)
          toggleDir(path)
          setOpenFile(null)
        } else if (err instanceof ApiRequestError && err.status === 404) {
          // Dead deep link (file deleted since the chip/message was written).
          toast.error(t('files.notFound', { path }))
          expandTo(path)
          setOpenFile(null)
        } else {
          setFileError(getErrorMessage(err))
        }
      } finally {
        setFileLoading(false)
      }
    },
    [activeAgentId, expandTo, toggleDir, t],
  )

  // Deep link: open ?path= once the agent is resolved.
  useEffect(() => {
    if (activeAgentId && requestedPath) void openPath(requestedPath)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAgentId, requestedPath])

  // Reset the open file when switching workspaces.
  useEffect(() => {
    setSelectedPath(null)
    setOpenFile(null)
    setFileError(null)
  }, [activeAgentId])

  const handleSelectFile = (entry: WorkspaceEntry) => {
    setTreeSheetOpen(false)
    void openPath(entry.path)
  }

  const handleAgentChange = (id: string) => {
    navigate(`/files/${id}`, { replace: false })
  }

  const rootState = dirs['']
  const workspaceIsEmpty = rootState?.entries != null && rootState.entries.length === 0

  const treePanel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border p-2">
        <AgentSelector
          value={activeAgentId ?? ''}
          onValueChange={handleAgentChange}
          agents={agents.map((a) => ({ id: a.id, name: a.name, role: a.role, avatarUrl: a.avatarUrl }))}
          placeholder={t('files.selectWorkspace')}
        />
      </div>
      {workspaceIsEmpty ? (
        <div className="flex flex-1 items-start justify-center p-4">
          <EmptyState
            icon={Folder}
            title={t('files.empty.title')}
            description={t('files.empty.description')}
            compact
          />
        </div>
      ) : (
        <WorkspaceTree
          dirs={dirs}
          expanded={expanded}
          selectedPath={selectedPath}
          onToggleDir={toggleDir}
          onSelectFile={handleSelectFile}
          onSelectDir={(entry) => setSelectedPath(entry.path)}
          onRetryDir={(path) => void loadDir(path)}
        />
      )}
    </div>
  )

  return (
    <div className="surface-base flex h-full flex-col overflow-hidden">
      <PageHeader
        icon={Folder}
        title={t('activityBar.files')}
        leading={
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setTreeSheetOpen(true)}
            aria-label={t('files.openTree')}
          >
            <FolderTree className="size-4" />
          </Button>
        }
        actions={
          <Button variant="ghost" size="icon-sm" onClick={refresh} aria-label={t('files.refresh')} title={t('files.refresh')}>
            <RefreshCw className="size-4" />
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1">
        {/* Tree panel — fixed column on md+, Sheet below */}
        <aside className="hidden w-64 shrink-0 border-r border-border md:flex md:flex-col lg:w-72">
          {treePanel}
        </aside>
        <Sheet open={treeSheetOpen} onOpenChange={setTreeSheetOpen}>
          <SheetContent side="left" className="w-80 p-0 md:hidden">
            <SheetTitle className="sr-only">{t('activityBar.files')}</SheetTitle>
            {treePanel}
          </SheetContent>
        </Sheet>

        {/* Center pane */}
        <main className="flex min-w-0 flex-1 flex-col">
          {agentsLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : !activeAgentId ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState icon={Folder} title={t('files.noAgents.title')} description={t('files.noAgents.description')} />
            </div>
          ) : fileLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : fileError ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState icon={Folder} title={t('files.openError')} description={fileError} minimal />
            </div>
          ) : openFile ? (
            <WorkspaceEditor agentId={activeAgentId} file={openFile} readOnly />
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                icon={FilePlus2}
                title={t('files.noFileOpen.title')}
                description={t('files.noFileOpen.description')}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
