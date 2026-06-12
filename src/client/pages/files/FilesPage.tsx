import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Folder, FolderTree, RefreshCw, Loader2, FilePlus2 } from 'lucide-react'
import { PageHeader } from '@/client/components/layout/PageHeader'
import { EmptyState } from '@/client/components/common/EmptyState'
import { AgentSelector } from '@/client/components/common/AgentSelector'
import { UnsavedChangesDialog } from '@/client/components/common/UnsavedChangesDialog'
import { Button } from '@/client/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/client/components/ui/sheet'
import { useAgentList } from '@/client/hooks/useAgentList'
import { useWorkspaceFiles } from '@/client/hooks/useWorkspaceFiles'
import { useWorkspaceTabs } from '@/client/hooks/useWorkspaceTabs'
import { WorkspaceTree } from '@/client/components/files/WorkspaceTree'
import { WorkspaceEditor } from '@/client/components/files/WorkspaceEditor'
import { FileTabs } from '@/client/components/files/FileTabs'
import type { WorkspaceEntry } from '@/shared/types'

const LAST_AGENT_KEY = 'files.lastAgentId'

/**
 * Files section (files.md § 3): VSCode-like browser/editor over agent
 * workspaces. Deep-linkable as /files/:agentId?path=relative/path.
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
    (routeAgentId ? (agents.find((a) => a.id === routeAgentId || a.slug === routeAgentId)?.id ?? null) : null) ??
    (storedAgentId && agents.some((a) => a.id === storedAgentId) ? storedAgentId : null) ??
    agents[0]?.id ??
    null

  useEffect(() => {
    if (activeAgentId) localStorage.setItem(LAST_AGENT_KEY, activeAgentId)
  }, [activeAgentId])

  const { dirs, expanded, loadDir, toggleDir, expandTo, refresh } = useWorkspaceFiles(activeAgentId)
  const tabsApi = useWorkspaceTabs(activeAgentId)

  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [treeSheetOpen, setTreeSheetOpen] = useState(false)
  const [closingTab, setClosingTab] = useState<string | null>(null)

  const openPath = useCallback(
    (path: string) => {
      setSelectedPath(path)
      expandTo(path)
      tabsApi.openTab(path)
    },
    [expandTo, tabsApi],
  )

  // Deep link: open ?path= once the agent list resolved the workspace.
  useEffect(() => {
    if (!activeAgentId || !requestedPath) return
    // A directory deep-link just expands the tree; a file opens a tab. We
    // can't know which without asking — openTab handles the 404/dir cases by
    // surfacing state; the cheap probe here is the ls of its parent.
    openPath(requestedPath)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAgentId, requestedPath])

  // Dead deep-link feedback (file vanished): the tab state flags deletedOnDisk.
  useEffect(() => {
    if (!requestedPath) return
    const state = tabsApi.states[requestedPath]
    if (state?.deletedOnDisk && !state.dirty) {
      toast.error(t('files.notFound', { path: requestedPath }))
      tabsApi.forceCloseTab(requestedPath)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabsApi.states[requestedPath ?? '']?.deletedOnDisk])

  const handleSelectFile = (entry: WorkspaceEntry) => {
    setTreeSheetOpen(false)
    openPath(entry.path)
  }

  const handleAgentChange = (id: string) => navigate(`/files/${id}`)

  const requestCloseTab = (path: string) => {
    if (tabsApi.states[path]?.dirty) {
      setClosingTab(path)
    } else {
      tabsApi.forceCloseTab(path)
    }
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
          <EmptyState icon={Folder} title={t('files.empty.title')} description={t('files.empty.description')} compact />
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

  const activeTab = tabsApi.active
  const activeState = activeTab ? tabsApi.states[activeTab] : undefined

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
        <aside className="hidden w-64 shrink-0 border-r border-border md:flex md:flex-col lg:w-72">{treePanel}</aside>
        <Sheet open={treeSheetOpen} onOpenChange={setTreeSheetOpen}>
          <SheetContent side="left" className="w-80 p-0 md:hidden">
            <SheetTitle className="sr-only">{t('activityBar.files')}</SheetTitle>
            {treePanel}
          </SheetContent>
        </Sheet>

        <main className="flex min-w-0 flex-1 flex-col">
          {agentsLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : !activeAgentId ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState icon={Folder} title={t('files.noAgents.title')} description={t('files.noAgents.description')} />
            </div>
          ) : (
            <>
              <FileTabs
                tabs={tabsApi.tabs}
                active={activeTab}
                dirtyPaths={new Set(Object.entries(tabsApi.states).filter(([, s]) => s.dirty).map(([p]) => p))}
                onSelect={(path) => {
                  setSelectedPath(path)
                  tabsApi.focusTab(path)
                }}
                onClose={requestCloseTab}
              />
              {activeTab && activeState ? (
                <WorkspaceEditor
                  agentId={activeAgentId}
                  path={activeTab}
                  state={activeState}
                  onChangeDraft={(value) => tabsApi.updateDraft(activeTab, value)}
                  onSave={(opts) => void tabsApi.save(activeTab, opts)}
                  onReload={() => void tabsApi.reload(activeTab)}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center p-6">
                  <EmptyState
                    icon={FilePlus2}
                    title={t('files.noFileOpen.title')}
                    description={t('files.noFileOpen.description')}
                  />
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <UnsavedChangesDialog
        open={closingTab !== null}
        onConfirm={() => {
          if (closingTab) tabsApi.forceCloseTab(closingTab)
          setClosingTab(null)
        }}
        onCancel={() => setClosingTab(null)}
      />
    </div>
  )
}
