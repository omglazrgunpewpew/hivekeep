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
import { Sparkles } from 'lucide-react'

interface KinFromApi {
  id: string
  name: string
  role?: string
  avatarUrl: string | null
  activeProjectId: string | null
}

interface EnrichTicketDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticketId: string
  projectId: string
}

export function EnrichTicketDialog({ open, onOpenChange, ticketId, projectId }: EnrichTicketDialogProps) {
  const { t } = useTranslation()
  const { enrichTicket } = useTickets(projectId)
  const [kins, setKins] = useState<KinFromApi[]>([])
  const [selectedKinId, setSelectedKinId] = useState<string>('')
  const [focus, setFocus] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    api
      .get<{ kins: KinFromApi[] }>('/kins')
      .then((data) => {
        if (cancelled) return
        setKins(data.kins)
        const match = data.kins.find((k) => k.activeProjectId === projectId)
        setSelectedKinId(match?.id ?? data.kins[0]?.id ?? '')
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [open, projectId])

  useEffect(() => {
    if (!open) setFocus('')
  }, [open])

  async function handleSubmit() {
    if (!selectedKinId) return
    setSubmitting(true)
    try {
      await enrichTicket(ticketId, selectedKinId, focus.trim() || undefined)
      toast.success(t('projects.enrich.started'))
      onOpenChange(false)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const sortedKins = [...kins].sort((a, b) => {
    const aActive = a.activeProjectId === projectId ? 1 : 0
    const bActive = b.activeProjectId === projectId ? 1 : 0
    return bActive - aActive
  })

  const kinOptions = sortedKins.map((k) => ({
    id: k.id,
    name: k.activeProjectId === projectId ? `${k.name} · ${t('projects.startTask.activeOnProject')}` : k.name,
    role: k.role,
    avatarUrl: k.avatarUrl,
  }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" />
            {t('projects.enrich.title')}
          </DialogTitle>
          <DialogDescription>{t('projects.enrich.description')}</DialogDescription>
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
            <Label htmlFor="enrich-focus">{t('projects.enrich.focusField')}</Label>
            <Textarea
              id="enrich-focus"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder={t('projects.enrich.focusPlaceholder')}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">{t('projects.enrich.focusHelp')}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedKinId || submitting}>
            <Sparkles className="mr-1 size-3.5" />
            {t('projects.enrich.start')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
