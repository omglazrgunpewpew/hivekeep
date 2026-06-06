import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, getErrorMessage } from '@/client/lib/api'
import { FormDialog } from '@/client/components/common/FormDialog'
import { FormField } from '@/client/components/common/FormField'
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
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="size-4" />
          {t('projects.enrich.title')}
        </span>
      }
      description={t('projects.enrich.description')}
      size="md"
      onSubmit={handleSubmit}
      isSubmitting={submitting}
      submitDisabled={!selectedKinId}
      submitLabel={t('projects.enrich.start')}
    >
      <FormField label={t('projects.startTask.kinField')}>
        <KinSelector
          value={selectedKinId}
          onValueChange={setSelectedKinId}
          kins={kinOptions}
          placeholder={t('projects.startTask.kinPlaceholder')}
        />
      </FormField>
      <FormField
        label={t('projects.enrich.focusField')}
        htmlFor="enrich-focus"
        hint={t('projects.enrich.focusHelp')}
      >
        <Textarea
          id="enrich-focus"
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder={t('projects.enrich.focusPlaceholder')}
          rows={3}
        />
      </FormField>
    </FormDialog>
  )
}
