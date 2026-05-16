import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, getErrorMessage } from '@/client/lib/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/client/components/ui/dialog'
import { Button } from '@/client/components/ui/button'
import { Label } from '@/client/components/ui/label'
import { Textarea } from '@/client/components/ui/textarea'
import { KinSelector } from '@/client/components/common/KinSelector'
import { useTickets } from '@/client/hooks/useTickets'
import { toast } from 'sonner'

interface KinFromApi {
  id: string
  name: string
  role?: string
  avatarUrl: string | null
  activeProjectId: string | null
}

interface StartTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticketId: string
  projectId: string
}

const RUN_PROMPT_MAX = 500

export function StartTaskDialog({ open, onOpenChange, ticketId, projectId }: StartTaskDialogProps) {
  const { t } = useTranslation()
  const { startTicketTask } = useTickets(projectId)
  const [kins, setKins] = useState<KinFromApi[]>([])
  const [selectedKinId, setSelectedKinId] = useState<string>('')
  const [runPrompt, setRunPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    api
      .get<{ kins: KinFromApi[] }>('/kins')
      .then((data) => {
        if (cancelled) return
        setKins(data.kins)
        // Pre-select first Kin that has this project as active
        const match = data.kins.find((k) => k.activeProjectId === projectId)
        setSelectedKinId(match?.id ?? data.kins[0]?.id ?? '')
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [open, projectId])

  // Reset the sur-prompt whenever the dialog reopens so a previous draft does
  // not leak into a fresh task spawn.
  useEffect(() => {
    if (!open) setRunPrompt('')
  }, [open])

  async function handleSubmit() {
    if (!selectedKinId) return
    setSubmitting(true)
    try {
      await startTicketTask(ticketId, selectedKinId, runPrompt.trim() || undefined)
      onOpenChange(false)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  // Sort kins so the project-active one (if any) appears first
  const sortedKins = [...kins].sort((a, b) => {
    const aActive = a.activeProjectId === projectId ? 1 : 0
    const bActive = b.activeProjectId === projectId ? 1 : 0
    return bActive - aActive
  })

  // KinSelector expects KinOption[] — our API shape is already compatible (id/name/role/avatarUrl)
  const kinOptions = sortedKins.map((k) => ({
    id: k.id,
    name: k.activeProjectId === projectId ? `${k.name} · ${t('projects.startTask.activeOnProject')}` : k.name,
    role: k.role,
    avatarUrl: k.avatarUrl,
  }))

  const runPromptLength = runPrompt.length
  const runPromptOverLimit = runPromptLength > RUN_PROMPT_MAX

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('projects.startTask.title')}</DialogTitle>
          <DialogDescription>{t('projects.startTask.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>{t('projects.startTask.kinField')}</Label>
            <KinSelector
              value={selectedKinId}
              onValueChange={setSelectedKinId}
              kins={kinOptions}
              placeholder={t('projects.startTask.kinPlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="start-task-run-prompt">{t('projects.startTask.runPromptField')}</Label>
            <Textarea
              id="start-task-run-prompt"
              value={runPrompt}
              onChange={(e) => setRunPrompt(e.target.value.slice(0, RUN_PROMPT_MAX))}
              placeholder={t('projects.startTask.runPromptPlaceholder')}
              rows={3}
              maxLength={RUN_PROMPT_MAX}
            />
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">{t('projects.startTask.runPromptHelp')}</p>
              <p className={`text-xs tabular-nums ${runPromptOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
                {t('projects.startTask.runPromptCounter', { count: runPromptLength })}
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedKinId || submitting || runPromptOverLimit}>
            {t('projects.startTask.start')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
